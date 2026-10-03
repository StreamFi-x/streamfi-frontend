/**
 * A/B Testing Framework & Experiment Tracking
 *
 * Builds on top of feature_flags to provide deterministic, sticky user assignment
 * to experiment variants. Unlike basic feature flags (which are re-evaluated per
 * request), experiment assignments are persisted so they can be joined against
 * outcome metrics later.
 *
 * Assignment is deterministic (user hashing) and sticky (persisted in DB),
 * enabling:
 * 1. Consistent variant across sessions
 * 2. Metrics pipeline joining assignments against outcomes
 * 3. Experiment lifecycle management (start, pause, conclude)
 * 4. Statistical analysis and significance testing
 */

import { sql } from '@vercel/postgres';
import crypto from 'crypto';
import { logger } from '@/lib/tracing/logger';

export type ExperimentStatus = 'planning' | 'running' | 'paused' | 'concluded';
export type VariantAssignment = 'control' | 'treatment_a' | 'treatment_b' | 'excluded';

export interface ExperimentDefinition {
  id: string;
  key: string; // Unique identifier, e.g., 'exp_homepage_redesign_v1'
  name: string;
  description?: string;
  status: ExperimentStatus;
  variants: string[]; // ['control', 'treatment_a', 'treatment_b']
  variant_weights: Record<string, number>; // e.g., { control: 0.5, treatment_a: 0.25, treatment_b: 0.25 }
  started_at: Date | null;
  concluded_at: Date | null;
  excluded_user_ids: string[]; // Users explicitly excluded from experiment
  created_at: Date;
  updated_at: Date;
}

export interface UserVariantAssignment {
  user_id: string;
  experiment_id: string;
  variant: VariantAssignment;
  assigned_at: Date;
  stable_hash: string; // For verification and consistency checks
}

export interface ExperimentEvent {
  id: string;
  user_id: string;
  experiment_id: string;
  event_type: string; // e.g., 'view', 'click', 'conversion', 'signup'
  event_data: Record<string, any>; // Flexible JSON for event-specific data
  recorded_at: Date;
  created_at: Date;
}

/**
 * Generate a deterministic hash of user + experiment for consistent assignment.
 * Uses HMAC-SHA256 to ensure consistency across deployments.
 */
export function generateStableHash(userId: string, experimentKey: string): string {
  const hmac = crypto.createHmac('sha256', 'experiment-seed-key');
  hmac.update(`${userId}:${experimentKey}`);
  return hmac.digest('hex');
}

/**
 * Compute which variant a user should be assigned to based on deterministic hashing.
 * Returns 0-99 percentile value.
 */
export function computeVariantBucket(userId: string, experimentKey: string): number {
  const hash = generateStableHash(userId, experimentKey);
  // Take first 8 hex chars, convert to int, mod 100 → 0-99
  const hashInt = parseInt(hash.substring(0, 8), 16);
  return hashInt % 100;
}

/**
 * Select variant based on bucket and variant weights.
 * Weights are cumulative buckets, e.g., { control: 50, treatment_a: 25, treatment_b: 25 }
 * means control gets buckets 0-49, treatment_a gets 50-74, treatment_b gets 75-99.
 */
export function selectVariantFromBucket(
  bucket: number,
  weights: Record<string, number>
): string {
  let cumulative = 0;
  for (const [variant, weight] of Object.entries(weights)) {
    cumulative += weight;
    if (bucket < cumulative) {
      return variant;
    }
  }
  // Fallback to last variant if rounding errors occur
  return Object.keys(weights)[Object.keys(weights).length - 1];
}

/**
 * Get or create a user's assignment to an experiment variant.
 * If assignment already exists, returns it. Otherwise, computes and persists new assignment.
 */
export async function getOrAssignVariant(
  userId: string,
  experimentId: string,
  experiment: ExperimentDefinition
): Promise<VariantAssignment> {
  try {
    // Check if user is explicitly excluded
    if (experiment.excluded_user_ids.includes(userId)) {
      return 'excluded';
    }

    // Try to find existing assignment
    const { rows: existing } = await sql`
      SELECT variant
      FROM user_experiment_assignments
      WHERE user_id = ${userId} AND experiment_id = ${experimentId}
      LIMIT 1
    `;

    if (existing.length > 0) {
      return existing[0].variant as VariantAssignment;
    }

    // Compute new assignment
    const bucket = computeVariantBucket(userId, experiment.key);
    const variant = selectVariantFromBucket(bucket, experiment.variant_weights);
    const stable_hash = generateStableHash(userId, experiment.key);

    // Persist assignment (with ON CONFLICT in case of race condition)
    await sql`
      INSERT INTO user_experiment_assignments
        (user_id, experiment_id, variant, stable_hash, assigned_at)
      VALUES
        (${userId}, ${experimentId}, ${variant}, ${stable_hash}, NOW())
      ON CONFLICT (user_id, experiment_id)
        DO UPDATE SET
          variant = EXCLUDED.variant,
          assigned_at = EXCLUDED.assigned_at
    `;

    logger.info('[experiment-tracker] User assigned to variant', {
      operation: 'getOrAssignVariant',
      userId,
      experimentId,
      experimentKey: experiment.key,
      variant,
      bucket,
    });

    return variant as VariantAssignment;
  } catch (error) {
    logger.error('[experiment-tracker] Failed to get/assign variant', {
      operation: 'getOrAssignVariant',
      userId,
      experimentId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Record an experiment outcome event for later analysis.
 * Events are joined against assignments to compute metrics and statistical tests.
 */
export async function recordExperimentEvent(
  userId: string,
  experimentId: string,
  eventType: string,
  eventData: Record<string, any> = {}
): Promise<void> {
  try {
    await sql`
      INSERT INTO experiment_events
        (user_id, experiment_id, event_type, event_data, recorded_at)
      VALUES
        (${userId}, ${experimentId}, ${eventType}, ${JSON.stringify(eventData)}, NOW())
    `;

    logger.info('[experiment-tracker] Event recorded', {
      operation: 'recordExperimentEvent',
      userId,
      experimentId,
      eventType,
    });
  } catch (error) {
    logger.error('[experiment-tracker] Failed to record event', {
      operation: 'recordExperimentEvent',
      userId,
      experimentId,
      eventType,
      error: error instanceof Error ? error.message : String(error),
    });
    // Non-critical, log but don't throw
  }
}

/**
 * Create a new experiment definition.
 * Only admins should be able to call this.
 */
export async function createExperiment(
  key: string,
  name: string,
  variants: string[],
  variantWeights: Record<string, number>,
  description?: string
): Promise<ExperimentDefinition> {
  try {
    const { rows } = await sql`
      INSERT INTO experiments
        (key, name, description, variants, variant_weights, status, created_at, updated_at)
      VALUES
        (${key}, ${name}, ${description || null}, ${JSON.stringify(variants)}, ${JSON.stringify(variantWeights)}, ${'planning'}, NOW(), NOW())
      RETURNING
        id, key, name, description, status, variants, variant_weights, started_at, concluded_at, excluded_user_ids, created_at, updated_at
    `;

    const exp = rows[0] as any;
    return {
      id: exp.id,
      key: exp.key,
      name: exp.name,
      description: exp.description,
      status: exp.status as ExperimentStatus,
      variants: JSON.parse(exp.variants),
      variant_weights: JSON.parse(exp.variant_weights),
      started_at: exp.started_at,
      concluded_at: exp.concluded_at,
      excluded_user_ids: exp.excluded_user_ids || [],
      created_at: exp.created_at,
      updated_at: exp.updated_at,
    };
  } catch (error) {
    logger.error('[experiment-tracker] Failed to create experiment', {
      operation: 'createExperiment',
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get experiment definition by ID.
 */
export async function getExperiment(experimentId: string): Promise<ExperimentDefinition | null> {
  try {
    const { rows } = await sql`
      SELECT
        id, key, name, description, status, variants, variant_weights, started_at, concluded_at, excluded_user_ids, created_at, updated_at
      FROM experiments
      WHERE id = ${experimentId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return null;
    }

    const exp = rows[0] as any;
    return {
      id: exp.id,
      key: exp.key,
      name: exp.name,
      description: exp.description,
      status: exp.status as ExperimentStatus,
      variants: JSON.parse(exp.variants),
      variant_weights: JSON.parse(exp.variant_weights),
      started_at: exp.started_at,
      concluded_at: exp.concluded_at,
      excluded_user_ids: exp.excluded_user_ids || [],
      created_at: exp.created_at,
      updated_at: exp.updated_at,
    };
  } catch (error) {
    logger.error('[experiment-tracker] Failed to get experiment', {
      operation: 'getExperiment',
      experimentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Update experiment status.
 */
export async function updateExperimentStatus(
  experimentId: string,
  newStatus: ExperimentStatus
): Promise<void> {
  try {
    const updateFields: Record<string, any> = { status: newStatus };

    if (newStatus === 'running') {
      updateFields.started_at = new Date();
    } else if (newStatus === 'concluded') {
      updateFields.concluded_at = new Date();
    }

    if (newStatus === 'running') {
      await sql`
        UPDATE experiments
        SET status = ${newStatus}, updated_at = NOW(), started_at = NOW()
        WHERE id = ${experimentId}
      `;
    } else if (newStatus === 'concluded') {
      await sql`
        UPDATE experiments
        SET status = ${newStatus}, updated_at = NOW(), concluded_at = NOW()
        WHERE id = ${experimentId}
      `;
    } else {
      await sql`
        UPDATE experiments
        SET status = ${newStatus}, updated_at = NOW()
        WHERE id = ${experimentId}
      `;
    }

    logger.info('[experiment-tracker] Experiment status updated', {
      operation: 'updateExperimentStatus',
      experimentId,
      newStatus,
    });
  } catch (error) {
    logger.error('[experiment-tracker] Failed to update status', {
      operation: 'updateExperimentStatus',
      experimentId,
      newStatus,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
