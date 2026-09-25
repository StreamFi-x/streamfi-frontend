/**
 * Tracked migration runner CLI. See docs/database-migrations.md.
 *
 *   npm run db:migrate -- status
 *   npm run db:migrate -- up [--dry-run] [--allow-out-of-order] [--allow-unbaselined]
 *   npm run db:migrate -- verify
 *   npm run db:migrate -- baseline (--all-legacy | --through <id> | --only <id,id>) [--dry-run] [--force]
 *   npm run db:migrate -- resolve <id> (--applied | --rolled-back)
 *   npm run db:migrate -- create <name>
 *
 * Connection: MIGRATION_DATABASE_URL, then POSTGRES_URL_NON_POOLING, then
 * DATABASE_URL. A direct (non-pooled) connection is required because the
 * migration lock is a session-level advisory lock.
 */
import { existsSync, promises as fs } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { Client } from "pg";
import {
  buildMigrationFilename,
  discoverMigrations,
  loadLegacyManifest,
} from "../lib/migrations/discovery";
import { MigrationRunner } from "../lib/migrations/runner";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = path.join(ROOT, "db", "migrations");
const MANIFEST = path.join(MIGRATIONS_DIR, "legacy-manifest.json");

function out(line = ""): void {
  process.stdout.write(`${line}\n`);
}

function flag(args: string[], name: string): boolean {
  return args.includes(name);
}

function option(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx === -1 ? undefined : args[idx + 1];
}

function connectionString(): string {
  const url =
    process.env.MIGRATION_DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Set MIGRATION_DATABASE_URL (or POSTGRES_URL_NON_POOLING / DATABASE_URL)"
    );
  }
  if (/-pooler\./.test(url)) {
    throw new Error(
      "The migration runner needs a direct connection; the pooled URL " +
        "(-pooler.) cannot hold the session-level migration lock"
    );
  }
  return url;
}

async function main(): Promise<number> {
  for (const envFile of [".env.local", ".env"]) {
    const full = path.join(ROOT, envFile);
    if (existsSync(full)) {
      dotenv.config({ path: full });
    }
  }

  const [command, ...args] = process.argv.slice(2);

  if (command === "create") {
    const name = args.filter(a => !a.startsWith("--")).join(" ");
    const file = buildMigrationFilename(name, new Date());
    const target = path.join(MIGRATIONS_DIR, file);
    await fs.writeFile(target, `-- ${name}\n\n`, { flag: "wx" });
    out(`Created db/migrations/${file}`);
    return 0;
  }

  const manifest = await loadLegacyManifest(MANIFEST);
  const migrations = await discoverMigrations(MIGRATIONS_DIR, manifest);

  const client = new Client({ connectionString: connectionString() });
  await client.connect();
  const runner = new MigrationRunner({
    client,
    migrations,
    appliedBy: `${os.userInfo().username}@${os.hostname()}`,
    log: out,
  });

  try {
    switch (command) {
      case "status": {
        for (const line of await runner.status()) {
          const when = line.appliedAt
            ? ` ${new Date(line.appliedAt).toISOString()}`
            : "";
          out(`${line.state.padEnd(18)} ${line.id}${when}`);
        }
        return 0;
      }
      case "verify": {
        const problems = await runner.verify();
        if (problems.length === 0) {
          out("OK: every recorded migration matches its file");
          return 0;
        }
        problems.forEach(p => out(`DRIFT: ${p}`));
        return 1;
      }
      case "up": {
        const result = await runner.up({
          dryRun: flag(args, "--dry-run"),
          allowOutOfOrder: flag(args, "--allow-out-of-order"),
          allowUnbaselined: flag(args, "--allow-unbaselined"),
        });
        if (flag(args, "--dry-run")) {
          out(result.pending.length ? "Would apply:" : "Nothing to apply");
          result.pending.forEach(id => out(`  ${id}`));
        } else {
          out(
            result.applied.length
              ? `Applied ${result.applied.length} migration(s)`
              : "Database is up to date"
          );
        }
        return 0;
      }
      case "baseline": {
        const only = option(args, "--only");
        const result = await runner.baseline({
          allLegacy: flag(args, "--all-legacy"),
          through: option(args, "--through"),
          only: only ? only.split(",").map(s => s.trim()) : undefined,
          force: flag(args, "--force"),
          dryRun: flag(args, "--dry-run"),
        });
        const verb = flag(args, "--dry-run") ? "Would record" : "Recorded";
        out(
          `${verb} ${result.recorded.length} legacy migration(s) as baselined`
        );
        result.recorded.forEach(id => out(`  ${id}`));
        if (result.skipped.length) {
          out(`Already recorded: ${result.skipped.join(", ")}`);
        }
        return 0;
      }
      case "resolve": {
        const id = args.find(a => !a.startsWith("--"));
        const outcome = flag(args, "--applied")
          ? "applied"
          : flag(args, "--rolled-back")
            ? "rolled-back"
            : undefined;
        if (!id || !outcome) {
          out("Usage: resolve <id> (--applied | --rolled-back)");
          return 2;
        }
        await runner.resolve(id, outcome);
        out(`Resolved ${id} as ${outcome}`);
        return 0;
      }
      default:
        out("Commands: status | verify | up | baseline | resolve | create");
        return 2;
    }
  } finally {
    await client.end();
  }
}

main().then(
  code => process.exit(code),
  error => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exit(1);
  }
);
