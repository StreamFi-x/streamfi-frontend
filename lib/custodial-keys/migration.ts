import { randomUUID, timingSafeEqual } from "crypto";
import { sql } from "@vercel/postgres";
import { Keypair } from "@stellar/stellar-sdk";
import { logger } from "@/lib/tracing/logger";
import { sendOperationalAlert } from "@/lib/security/alerts";
import {
  ENVELOPE_PREFIX,
  decryptCustodialSecret,
  detectCustodialKeyFormat,
  encryptCustodialSecret,
  envelopeKeyId,
} from "./index";
import { CustodialKeyError } from "./errors";
import { decryptLegacyCustodialSecret } from "./legacy";

/**
 * Static-key → KMS-envelope migration for users.encrypted_stellar_key.
 *
 * Per row:  legacy decrypt → wallet check → new envelope (fresh DEK via KMS)
 *           → KMS round-trip verify → conditional UPDATE → audit event.
 *
 * - Resumable/idempotent: rows are selected by the absence of the explicit
 *   `ckv2:` version prefix, so migrated rows are never touched again and a
 *   rerun continues where an interrupted one stopped.
 * - Never loses a key: the new envelope must decrypt (through KMS) back to
 *   the exact legacy plaintext, whose public key must equal users.wallet,
 *   before anything is written. The legacy ciphertext is preserved in
 *   encrypted_stellar_key_legacy until `purgeLegacyBackups` re-verifies.
 * - Concurrency-safe: the UPDATE only applies if encrypted_stellar_key still
 *   holds the value that was verified (e.g. not regenerated mid-run).
 * - Failures skip the row with an audit event and never mark it migrated.
 * - Plaintext keys are never logged, persisted or included in errors.
 */

export type MigrationMode = "migrate" | "dry_run" | "verify" | "purge_legacy";

export interface MigrationReport {
  run_id: string;
  mode: MigrationMode;
  scanned: number;
  succeeded: number;
  failed: number;
  skipped: number;
  failures: Array<{ user_id: string; reason: string }>;
}

interface UserKeyRow {
  id: string;
  wallet: string | null;
  encrypted_stellar_key: string;
  encrypted_stellar_key_legacy?: string | null;
}

const FIRST_ID = "00000000-0000-0000-0000-000000000000";

function newReport(mode: MigrationMode): MigrationReport {
  return {
    run_id: `ckm-${new Date().toISOString()}-${randomUUID().slice(0, 8)}`,
    mode,
    scanned: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    failures: [],
  };
}

function reasonFor(err: unknown): string {
  return err instanceof CustodialKeyError
    ? err.code.toLowerCase()
    : "unexpected_error";
}

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Public key of a Stellar secret, or null if it is not a valid secret. */
function publicKeyOf(secret: string): string | null {
  try {
    return Keypair.fromSecret(secret).publicKey();
  } catch {
    return null;
  }
}

async function audit(
  report: MigrationReport,
  userId: string | null,
  outcome: "succeeded" | "failed" | "skipped",
  reason: string,
  kmsKeyId: string | null = null
): Promise<void> {
  if (outcome === "succeeded") {
    report.succeeded++;
  } else if (outcome === "failed") {
    report.failed++;
    if (userId) {
      report.failures.push({ user_id: userId, reason });
    }
  } else {
    report.skipped++;
  }

  const event =
    outcome === "failed"
      ? "custodial_key_migration_failure"
      : "custodial_key_migration_success";
  const fields = {
    run_id: report.run_id,
    mode: report.mode,
    user_id: userId,
    outcome,
    reason,
    kms_key_id: kmsKeyId,
  };
  if (outcome === "failed") {
    logger.error(event, fields);
  } else {
    logger.info(event, fields);
  }

  await sql`
    INSERT INTO custodial_key_migration_events
      (run_id, user_id, mode, outcome, reason, kms_key_id)
    VALUES (${report.run_id}, ${userId}, ${report.mode}, ${outcome}, ${reason}, ${kmsKeyId})
  `;
}

async function migrateRow(
  row: UserKeyRow,
  report: MigrationReport,
  acceptWalletMismatch: boolean
): Promise<void> {
  const legacy = row.encrypted_stellar_key;
  if (detectCustodialKeyFormat(legacy) !== "legacy_v1") {
    await audit(report, row.id, "failed", "unknown_format");
    return;
  }

  let plaintext: string;
  try {
    plaintext = decryptLegacyCustodialSecret(legacy);
  } catch (err) {
    await audit(report, row.id, "failed", `legacy_decrypt_${reasonFor(err)}`);
    return;
  }

  // Refuse to carry forward a key that does not control the user's wallet.
  const publicKey = publicKeyOf(plaintext);
  if (!publicKey) {
    await audit(
      report,
      row.id,
      "failed",
      "legacy_plaintext_not_a_stellar_secret"
    );
    return;
  }
  const walletMismatch = publicKey !== row.wallet;
  if (walletMismatch && !acceptWalletMismatch) {
    await audit(report, row.id, "failed", "wallet_mismatch");
    return;
  }

  let envelope: string;
  try {
    envelope = await encryptCustodialSecret(row.id, plaintext);
    const roundTrip = await decryptCustodialSecret(row.id, envelope);
    if (!sameSecret(roundTrip, plaintext)) {
      await audit(report, row.id, "failed", "verification_mismatch");
      return;
    }
  } catch (err) {
    await audit(report, row.id, "failed", `kms_${reasonFor(err)}`);
    return;
  }

  const kmsKeyId = envelopeKeyId(envelope);
  if (report.mode === "dry_run") {
    await audit(report, row.id, "succeeded", "dry_run_verified", kmsKeyId);
    return;
  }

  const { rows } = await sql`
    UPDATE users SET
      encrypted_stellar_key        = ${envelope},
      encrypted_stellar_key_legacy = ${legacy},
      custodial_key_migrated_at    = NOW()
    WHERE id = ${row.id} AND encrypted_stellar_key = ${legacy}
    RETURNING id
  `;
  if (rows.length === 0) {
    await audit(report, row.id, "skipped", "changed_concurrently");
    return;
  }
  await audit(
    report,
    row.id,
    "succeeded",
    walletMismatch ? "migrated_wallet_mismatch_accepted" : "migrated",
    kmsKeyId
  );
}

async function alertOnFailures(report: MigrationReport): Promise<void> {
  if (report.failed === 0) {
    return;
  }
  await sendOperationalAlert({
    category: "custodial_keys",
    event: "custodial_key_migration_failure",
    severity: "critical",
    title: `Custodial key ${report.mode} run finished with failures`,
    dedupKey: `custodial_key_migration:${report.run_id}`,
    cooldownSeconds: 60 * 60,
    details: {
      run_id: report.run_id,
      mode: report.mode,
      scanned: report.scanned,
      succeeded: report.succeeded,
      failed: report.failed,
    },
  });
}

/**
 * Re-encrypts every legacy row into a KMS envelope, in id order, in batches.
 * `dryRun` performs every step except the UPDATE. Rows whose key does not
 * control users.wallet are left alone for manual review unless
 * `acceptWalletMismatch` is set (the key is still carried over bit-for-bit).
 */
export async function migrateLegacyCustodialKeys(
  opts: {
    batchSize?: number;
    dryRun?: boolean;
    limit?: number;
    acceptWalletMismatch?: boolean;
  } = {}
): Promise<MigrationReport> {
  const batchSize = opts.batchSize ?? 100;
  const report = newReport(opts.dryRun ? "dry_run" : "migrate");
  let cursor = FIRST_ID;

  for (;;) {
    const remaining =
      opts.limit === undefined
        ? batchSize
        : Math.min(batchSize, opts.limit - report.scanned);
    if (remaining <= 0) {
      break;
    }
    const { rows } = await sql<UserKeyRow>`
      SELECT id, wallet, encrypted_stellar_key
      FROM users
      WHERE encrypted_stellar_key IS NOT NULL
        AND encrypted_stellar_key NOT LIKE ${ENVELOPE_PREFIX + "%"}
        AND id > ${cursor}::uuid
      ORDER BY id
      LIMIT ${remaining}
    `;
    if (rows.length === 0) {
      break;
    }
    for (const row of rows) {
      report.scanned++;
      cursor = row.id;
      await migrateRow(row, report, opts.acceptWalletMismatch === true);
    }
  }

  await alertOnFailures(report);
  return report;
}

/**
 * Re-verifies every migrated row through KMS: the envelope must decrypt to a
 * secret controlling users.wallet and, while a legacy backup is present,
 * equal the legacy plaintext.
 */
async function verifyRow(row: UserKeyRow, report: MigrationReport) {
  let secret: string;
  try {
    secret = await decryptCustodialSecret(row.id, row.encrypted_stellar_key);
  } catch (err) {
    await audit(report, row.id, "failed", `kms_${reasonFor(err)}`);
    return false;
  }
  if (!publicKeyOf(secret)) {
    await audit(report, row.id, "failed", "not_a_stellar_secret");
    return false;
  }
  if (!row.encrypted_stellar_key_legacy && publicKeyOf(secret) !== row.wallet) {
    await audit(report, row.id, "failed", "wallet_mismatch");
    return false;
  }
  if (row.encrypted_stellar_key_legacy) {
    let legacy: string;
    try {
      legacy = decryptLegacyCustodialSecret(row.encrypted_stellar_key_legacy);
    } catch (err) {
      await audit(report, row.id, "failed", `legacy_decrypt_${reasonFor(err)}`);
      return false;
    }
    if (!sameSecret(secret, legacy)) {
      await audit(report, row.id, "failed", "legacy_backup_mismatch");
      return false;
    }
  }
  return true;
}

async function forEachEnvelopeRow(
  batchSize: number,
  onlyWithLegacyBackup: boolean,
  fn: (row: UserKeyRow) => Promise<void>
) {
  let cursor = FIRST_ID;
  for (;;) {
    const { rows } = await sql<UserKeyRow>`
      SELECT id, wallet, encrypted_stellar_key, encrypted_stellar_key_legacy
      FROM users
      WHERE encrypted_stellar_key LIKE ${ENVELOPE_PREFIX + "%"}
        AND (${!onlyWithLegacyBackup} OR encrypted_stellar_key_legacy IS NOT NULL)
        AND id > ${cursor}::uuid
      ORDER BY id
      LIMIT ${batchSize}
    `;
    if (rows.length === 0) {
      return;
    }
    for (const row of rows) {
      cursor = row.id;
      await fn(row);
    }
  }
}

export async function verifyMigratedCustodialKeys(
  opts: { batchSize?: number } = {}
): Promise<MigrationReport> {
  const report = newReport("verify");
  await forEachEnvelopeRow(opts.batchSize ?? 100, false, async row => {
    report.scanned++;
    if (await verifyRow(row, report)) {
      await audit(
        report,
        row.id,
        "succeeded",
        "verified",
        envelopeKeyId(row.encrypted_stellar_key)
      );
    }
  });
  await alertOnFailures(report);
  return report;
}

export async function countLegacyCustodialKeys(): Promise<number> {
  const { rows } = await sql<{ count: string }>`
    SELECT COUNT(*)::text AS count FROM users
    WHERE encrypted_stellar_key IS NOT NULL
      AND encrypted_stellar_key NOT LIKE ${ENVELOPE_PREFIX + "%"}
  `;
  return Number(rows[0]?.count ?? 0);
}

export class LegacyRowsRemainError extends Error {}

/**
 * Final migration step before retiring STELLAR_ENCRYPTION_KEY: re-verifies
 * each migrated row and only then drops its legacy backup. Refuses to run
 * while any row is still in the legacy format.
 */
export async function purgeLegacyBackups(
  opts: { batchSize?: number } = {}
): Promise<MigrationReport> {
  const remaining = await countLegacyCustodialKeys();
  if (remaining > 0) {
    throw new LegacyRowsRemainError(
      `${remaining} custodial keys are still in the legacy format — migrate them first`
    );
  }
  const report = newReport("purge_legacy");
  await forEachEnvelopeRow(opts.batchSize ?? 100, true, async row => {
    report.scanned++;
    if (!(await verifyRow(row, report))) {
      return;
    }
    const { rows } = await sql`
      UPDATE users SET encrypted_stellar_key_legacy = NULL
      WHERE id = ${row.id}
        AND encrypted_stellar_key = ${row.encrypted_stellar_key}
      RETURNING id
    `;
    if (rows.length === 0) {
      await audit(report, row.id, "skipped", "changed_concurrently");
      return;
    }
    await audit(
      report,
      row.id,
      "succeeded",
      "legacy_backup_purged",
      envelopeKeyId(row.encrypted_stellar_key)
    );
  });
  await alertOnFailures(report);
  return report;
}
