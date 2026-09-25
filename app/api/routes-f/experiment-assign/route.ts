import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth/verify-session';
import { getOrAssignVariant, getExperiment } from '@/lib/experimentation/experiment-tracker';
import { logger } from '@/lib/tracing/logger';

export const runtime = 'nodejs';

/**
 * GET /api/routes-f/experiment-assign?experiment_id=<id>
 *
 * Returns the authenticated user's assigned variant for an experiment.
 * If no assignment exists, creates one deterministically and persists it.
 *
 * Assignment is sticky — the same user will always get the same variant
 * for the same experiment, enabling proper A/B testing.
 *
 * Query Parameters:
 *   experiment_id: UUID of the experiment
 *
 * Response:
 *   {
 *     experiment_id: string
 *     user_id: string
 *     variant: "control" | "treatment_a" | "treatment_b" | "excluded"
 *     assigned_at: string (ISO timestamp)
 *   }
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    const { searchParams } = new URL(req.url);
    const experimentId = searchParams.get('experiment_id');

    if (!experimentId) {
      return NextResponse.json(
        { error: 'Missing experiment_id parameter' },
        { status: 400 }
      );
    }

    // Fetch experiment definition
    const experiment = await getExperiment(experimentId);
    if (!experiment) {
      logger.warn('[experiment-assign] Experiment not found', {
        operation: 'experiment-assign.GET',
        experimentId,
      });
      return NextResponse.json(
        { error: 'Experiment not found' },
        { status: 404 }
      );
    }

    // Get or assign variant
    const variant = await getOrAssignVariant(session.userId, experimentId, experiment);

    logger.info('[experiment-assign] Variant assigned', {
      operation: 'experiment-assign.GET',
      userId: session.userId,
      experimentId,
      variant,
    });

    return NextResponse.json(
      {
        experiment_id: experimentId,
        user_id: session.userId,
        variant,
        assigned_at: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=3600',
        },
      }
    );
  } catch (error) {
    logger.error('[experiment-assign] GET error', {
      operation: 'experiment-assign.GET',
      userId: session.userId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Failed to assign experiment variant' },
      { status: 500 }
    );
  }
}
