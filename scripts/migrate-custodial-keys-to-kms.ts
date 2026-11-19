#!/usr/bin/env node
/**
 * Custodial key KMS migration CLI (#1396). See docs/custodial-key-kms.md.
 *
 * Usage:
 *   npm run migrate:custodial-keys -- --dry-run            # verify, write nothing
 *   npm run migrate:custodial-keys -- --migrate            # re-encrypt legacy rows
 *   npm run migrate:custodial-keys -- --verify             # re-check all envelopes
 *   npm run migrate:custodial-keys -- --purge-legacy --confirm
 *
 * Options: --batch-size <n> (default 100), --limit <n> (migrate/dry-run only),
 *          --accept-wallet-mismatch (migrate keys that do not control
 *          users.wallet — only after manual review).
 *
 * Requires POSTGRES_URL, CUSTODIAL_KEY_KMS_KEY_ID (+ AWS credentials) and,
 * for migrate/dry-run/verify/purge, STELLAR_ENCRYPTION_KEY. Safe to
 * interrupt and re-run at any point. Prints identifiers and outcomes only —
 * never key material.
 */

import { config } from "dotenv";
import {
  migrateLegacyCustodialKeys,
  purgeLegacyBackups,
  verifyMigratedCustodialKeys,
  type MigrationReport,
} from "../lib/custodial-keys/migration";

config({ path: ".env.local" });

const args = process.argv.slice(2);
const has = (flag: string) => args.includes(flag);
function numberArg(flag: string): number | undefined {
  const i = args.indexOf(flag);
  if (i === -1) {
    return undefined;
  }
  const value = Number(args[i + 1]);
  if (!Number.isInteger(value) || value <= 0) {
    console.error(`✗ ${flag} expects a positive integer`);
    process.exit(2);
  }
  return value;
}

function print(report: MigrationReport) {
  console.log(
    JSON.stringify(
      {
        run_id: report.run_id,
        mode: report.mode,
        scanned: report.scanned,
        succeeded: report.succeeded,
        failed: report.failed,
        skipped: report.skipped,
        failures: report.failures,
      },
      null,
      2
    )
  );
}

async function main() {
  const batchSize = numberArg("--batch-size");
  const modes = ["--dry-run", "--migrate", "--verify", "--purge-legacy"].filter(
    has
  );
  if (modes.length !== 1) {
    console.error(
      "✗ Choose exactly one of --dry-run, --migrate, --verify, --purge-legacy"
    );
    process.exit(2);
  }

  let report: MigrationReport;
  switch (modes[0]) {
    case "--dry-run":
    case "--migrate":
      report = await migrateLegacyCustodialKeys({
        batchSize,
        dryRun: modes[0] === "--dry-run",
        limit: numberArg("--limit"),
        acceptWalletMismatch: has("--accept-wallet-mismatch"),
      });
      break;
    case "--verify":
      report = await verifyMigratedCustodialKeys({ batchSize });
      break;
    default:
      if (!has("--confirm")) {
        console.error(
          "✗ --purge-legacy permanently drops the legacy ciphertext backups; re-run with --confirm"
        );
        process.exit(2);
      }
      report = await purgeLegacyBackups({ batchSize });
  }

  print(report);
  process.exit(report.failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(
    "✗ Migration aborted:",
    err instanceof Error ? err.message : err
  );
  process.exit(1);
});
