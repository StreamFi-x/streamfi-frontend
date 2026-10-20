/**
 * scripts/migration-registry.ts
 *
 * Lightweight Migration Tracking Mechanism & Ordering Safeguards for scripts/
 * Addresses Issue #1767
 *
 * Commands:
 *   npx tsx scripts/migration-registry.ts --status
 *   npx tsx scripts/migration-registry.ts --dry-run
 *   npx tsx scripts/migration-registry.ts --apply <scriptName>
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface ScriptMigrationEntry {
  id: number;
  name: string;
  type: 'sql' | 'ts' | 'mjs';
  dependencies: string[];
  isIdempotent: boolean;
  dangerLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
}

/**
 * Explicit documented execution order for historical migrations in scripts/
 */
export const SCRIPT_MIGRATION_ORDER: ScriptMigrationEntry[] = [
  {
    id: 1,
    name: 'migrate-to-mux.sql',
    type: 'sql',
    dependencies: [],
    isIdempotent: true,
    dangerLevel: 'HIGH',
    description: 'Initializes Mux video asset schema and deprecates Livepeer columns.',
  },
  {
    id: 2,
    name: 'audit-livepeer-legacy.ts',
    type: 'ts',
    dependencies: ['migrate-to-mux.sql'],
    isIdempotent: true,
    dangerLevel: 'LOW',
    description: 'Audits remaining legacy Livepeer stream references prior to key migration.',
  },
  {
    id: 3,
    name: 'migrate-admin-allowlist.ts',
    type: 'ts',
    dependencies: [],
    isIdempotent: true,
    dangerLevel: 'MEDIUM',
    description: 'Seeds initial platform admin addresses and role privileges.',
  },
  {
    id: 4,
    name: 'updateUserSchema.mjs',
    type: 'mjs',
    dependencies: [],
    isIdempotent: true,
    dangerLevel: 'MEDIUM',
    description: 'Adds extended profile and notification preferences to user records.',
  },
  {
    id: 5,
    name: 'migrate-custodial-keys-to-kms.ts',
    type: 'ts',
    dependencies: ['updateUserSchema.mjs'],
    isIdempotent: false,
    dangerLevel: 'CRITICAL',
    description: 'Re-encrypts custodial user private keys into AWS KMS. NON-IDEMPOTENT.',
  },
  {
    id: 6,
    name: 'rotate-stellar-encryption-key.ts',
    type: 'ts',
    dependencies: ['migrate-custodial-keys-to-kms.ts'],
    isIdempotent: false,
    dangerLevel: 'CRITICAL',
    description: 'Rotates Stellar network secret master key. NON-IDEMPOTENT.',
  },
  {
    id: 7,
    name: 'migrate-tip-counter.mjs',
    type: 'mjs',
    dependencies: ['updateUserSchema.mjs'],
    isIdempotent: true,
    dangerLevel: 'LOW',
    description: 'Initializes and backfills aggregate tipping counters per creator.',
  },
];

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TRACKING_FILE = path.join(__dirname, '.migration-tracking.json');

export interface MigrationState {
  appliedMigrations: Record<string, { appliedAt: string; checksum: string }>;
}

export function loadTrackingState(): MigrationState {
  if (fs.existsSync(TRACKING_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(TRACKING_FILE, 'utf8'));
    } catch {
      return { appliedMigrations: {} };
    }
  }
  return { appliedMigrations: {} };
}

export function saveTrackingState(state: MigrationState): void {
  fs.writeFileSync(TRACKING_FILE, JSON.stringify(state, null, 2), 'utf8');
}

export function computeFileChecksum(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Validates whether a migration can safely run
 */
export function validateRunSafeguards(scriptName: string, state: MigrationState): { canRun: boolean; reason?: string } {
  const entry = SCRIPT_MIGRATION_ORDER.find((m) => m.name === scriptName);
  if (!entry) {
    return { canRun: false, reason: `Unknown migration script: "${scriptName}". Only registered migrations can be tracked.` };
  }

  // Idempotency check
  if (state.appliedMigrations[scriptName] && !entry.isIdempotent) {
    return {
      canRun: false,
      reason: `SAFEGUARD PREVENTED EXECUTION: Script "${scriptName}" is NOT idempotent and has already been applied on ${state.appliedMigrations[scriptName].appliedAt}. Re-running would cause data corruption.`,
    };
  }

  // Dependency check
  for (const dep of entry.dependencies) {
    if (!state.appliedMigrations[dep]) {
      return {
        canRun: false,
        reason: `DEPENDENCY ORDER VIOLATION: Cannot execute "${scriptName}". Required dependency "${dep}" has not been applied yet.`,
      };
    }
  }

  return { canRun: true };
}

// CLI handler
if (typeof process !== 'undefined' && process.argv[1]?.includes('migration-registry')) {
  const args = process.argv.slice(2);
  const state = loadTrackingState();

  if (args.includes('--status') || args.length === 0) {
    console.log('\n=== StreamFi Scripts Migration Registry Status ===');
    console.log('ID | Script Name | Idempotent | Danger | Status | Applied At');
    console.log('----------------------------------------------------------------------');
    for (const m of SCRIPT_MIGRATION_ORDER) {
      const applied = state.appliedMigrations[m.name];
      const status = applied ? 'APPLIED' : 'PENDING';
      const appliedAt = applied ? applied.appliedAt : '-';
      console.log(`${m.id.toString().padEnd(2)} | ${m.name.padEnd(32)} | ${(m.isIdempotent ? 'YES' : 'NO').padEnd(10)} | ${m.dangerLevel.padEnd(8)} | ${status.padEnd(7)} | ${appliedAt}`);
    }
    console.log('----------------------------------------------------------------------\n');
  } else if (args.includes('--dry-run')) {
    console.log('[DRY-RUN] Verifying script execution order and safeguards...');
    for (const m of SCRIPT_MIGRATION_ORDER) {
      const check = validateRunSafeguards(m.name, state);
      if (!check.canRun) {
        console.log(`[DRY-RUN BLOCK] ${m.name}: ${check.reason}`);
      } else {
        console.log(`[DRY-RUN OK] ${m.name} is safe to run.`);
      }
    }
  }
}
