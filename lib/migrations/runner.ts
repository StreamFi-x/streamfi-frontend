import type { Migration } from "./discovery";
import { splitSqlStatements } from "./sql-splitter";

/** Minimal client surface; satisfied by a single `pg.Client` connection. */
export interface MigrationClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query(text: string, params?: unknown[]): Promise<{ rows: any[] }>;
}

export type MigrationStatus = "applied" | "baselined" | "running" | "failed";

export interface AppliedMigrationRow {
  version: string;
  file: string;
  kind: string;
  checksum: string;
  status: MigrationStatus;
  transactional: boolean;
  applied_at: Date;
  execution_ms: number | null;
  applied_by: string | null;
  error: string | null;
}

export interface MigrationStatusLine {
  id: string;
  state: MigrationStatus | "pending" | "checksum_mismatch" | "missing_file";
  appliedAt?: Date;
}

export interface RunnerOptions {
  client: MigrationClient;
  migrations: Migration[];
  /** Advisory lock key shared by every runner pointed at the same database. */
  lockKey?: string;
  lockTimeoutMs?: number;
  lockPollMs?: number;
  appliedBy?: string;
  /** Table whose presence means "this database already has a schema". */
  existingSchemaSentinel?: string;
  log?: (message: string) => void;
}

export class MigrationDriftError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Migration state is inconsistent:\n- ${problems.join("\n- ")}`);
    this.name = "MigrationDriftError";
  }
}

export class MigrationExecutionError extends Error {
  constructor(
    public readonly migrationId: string,
    public readonly cause: unknown
  ) {
    super(
      `Migration ${migrationId} failed: ${
        cause instanceof Error ? cause.message : String(cause)
      }`
    );
    this.name = "MigrationExecutionError";
  }
}

export class MigrationLockTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(
      `Could not acquire the migration lock within ${timeoutMs}ms; ` +
        "another migration run is in progress"
    );
    this.name = "MigrationLockTimeoutError";
  }
}

/** Arbitrary, stable 64-bit key: "streamfi schema_migrations". */
export const DEFAULT_MIGRATION_LOCK_KEY = "7253190000142";

const CREATE_TRACKING_TABLE = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version       TEXT PRIMARY KEY,
  file          TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('legacy', 'versioned')),
  checksum      CHAR(64) NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('applied', 'baselined', 'running', 'failed')),
  transactional BOOLEAN NOT NULL,
  applied_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  execution_ms  INTEGER,
  applied_by    TEXT,
  error         TEXT
)`;

const TRANSACTION_CONTROL =
  /^(BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION|END|SAVEPOINT|RELEASE)\b/i;

export class MigrationRunner {
  private readonly client: MigrationClient;
  private readonly migrations: Migration[];
  private readonly lockKey: string;
  private readonly lockTimeoutMs: number;
  private readonly lockPollMs: number;
  private readonly appliedBy: string;
  private readonly sentinel: string;
  private readonly log: (message: string) => void;

  constructor(options: RunnerOptions) {
    this.client = options.client;
    this.migrations = options.migrations;
    this.lockKey = options.lockKey ?? DEFAULT_MIGRATION_LOCK_KEY;
    this.lockTimeoutMs = options.lockTimeoutMs ?? 120_000;
    this.lockPollMs = options.lockPollMs ?? 500;
    this.appliedBy = options.appliedBy ?? "unknown";
    this.sentinel = options.existingSchemaSentinel ?? "users";
    this.log = options.log ?? (() => undefined);

    for (const migration of this.migrations) {
      if (!migration.transactional) {
        continue;
      }
      const control = splitSqlStatements(migration.sql).find(s =>
        TRANSACTION_CONTROL.test(stripLeadingComments(s))
      );
      if (control) {
        throw new MigrationDriftError([
          `Migration ${migration.id} contains transaction control ` +
            `("${control.slice(0, 40)}"); the runner wraps each migration in ` +
            "its own transaction. Remove it, or mark the file " +
            "`-- migrate:no-transaction`.",
        ]);
      }
    }
  }

  /**
   * Holds a session-level advisory lock for the duration of `fn`. The lock
   * lives in the database, so it serialises runners across machines and
   * containers, not just processes on one host.
   */
  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const deadline = Date.now() + this.lockTimeoutMs;
    for (;;) {
      const { rows } = await this.client.query(
        "SELECT pg_try_advisory_lock($1::bigint) AS locked",
        [this.lockKey]
      );
      if (rows[0]?.locked === true) {
        break;
      }
      if (Date.now() >= deadline) {
        throw new MigrationLockTimeoutError(this.lockTimeoutMs);
      }
      this.log("Waiting for another migration run to finish...");
      await new Promise(resolve => setTimeout(resolve, this.lockPollMs));
    }

    try {
      return await fn();
    } finally {
      await this.client.query("SELECT pg_advisory_unlock($1::bigint)", [
        this.lockKey,
      ]);
    }
  }

  private async ensureTrackingTable(): Promise<void> {
    await this.client.query(CREATE_TRACKING_TABLE);
  }

  private async trackingTableExists(): Promise<boolean> {
    const { rows } = await this.client.query(
      "SELECT to_regclass('schema_migrations') IS NOT NULL AS present"
    );
    return rows[0]?.present === true;
  }

  private async readApplied(): Promise<AppliedMigrationRow[]> {
    const { rows } = await this.client.query(
      "SELECT * FROM schema_migrations ORDER BY applied_at, version"
    );
    return rows as AppliedMigrationRow[];
  }

  /** Problems that make it unsafe to apply anything. */
  private findDrift(applied: AppliedMigrationRow[]): string[] {
    const byId = new Map(this.migrations.map(m => [m.id, m]));
    const problems: string[] = [];

    for (const row of applied) {
      const migration = byId.get(row.version);
      if (!migration) {
        problems.push(
          `${row.version} is recorded as ${row.status} but its file is missing`
        );
        continue;
      }
      if (migration.checksum !== row.checksum.trim()) {
        problems.push(
          `${row.version} changed after it was ${row.status} ` +
            `(recorded ${row.checksum.trim()}, file ${migration.checksum})`
        );
      }
      if (row.status === "failed" || row.status === "running") {
        problems.push(
          `${row.version} is ${row.status}${row.error ? `: ${row.error}` : ""}. ` +
            "Inspect the database, then run `resolve` before migrating again"
        );
      }
    }

    return problems;
  }

  async status(): Promise<MigrationStatusLine[]> {
    const applied = (await this.trackingTableExists())
      ? await this.readApplied()
      : [];
    const byVersion = new Map(applied.map(r => [r.version, r]));
    const lines: MigrationStatusLine[] = this.migrations.map(m => {
      const row = byVersion.get(m.id);
      if (!row) {
        return { id: m.id, state: "pending" };
      }
      if (row.checksum.trim() !== m.checksum) {
        return {
          id: m.id,
          state: "checksum_mismatch",
          appliedAt: row.applied_at,
        };
      }
      return { id: m.id, state: row.status, appliedAt: row.applied_at };
    });
    const known = new Set(this.migrations.map(m => m.id));
    for (const row of applied) {
      if (!known.has(row.version)) {
        lines.push({
          id: row.version,
          state: "missing_file",
          appliedAt: row.applied_at,
        });
      }
    }
    return lines;
  }

  async verify(): Promise<string[]> {
    if (!(await this.trackingTableExists())) {
      return ["schema_migrations does not exist; run baseline or up first"];
    }
    return this.findDrift(await this.readApplied());
  }

  async up(
    options: {
      allowOutOfOrder?: boolean;
      allowUnbaselined?: boolean;
      dryRun?: boolean;
    } = {}
  ): Promise<{ applied: string[]; pending: string[] }> {
    return this.withLock(async () => {
      await this.ensureTrackingTable();
      const applied = await this.readApplied();

      const problems = this.findDrift(applied);
      if (problems.length > 0) {
        throw new MigrationDriftError(problems);
      }

      if (applied.length === 0 && !options.allowUnbaselined) {
        const { rows } = await this.client.query(
          "SELECT to_regclass($1) IS NOT NULL AS present",
          [this.sentinel]
        );
        if (rows[0]?.present === true) {
          throw new MigrationDriftError([
            `This database already has a schema (table "${this.sentinel}" exists) ` +
              "but no migration history. Record the migrations it already has " +
              "with `baseline` before running `up`, so historical migrations " +
              "are not replayed.",
          ]);
        }
      }

      const appliedIds = new Set(applied.map(r => r.version));
      const pending = this.migrations.filter(m => !appliedIds.has(m.id));

      if (!options.allowOutOfOrder) {
        const lastAppliedIndex = this.migrations.reduce(
          (max, m, idx) => (appliedIds.has(m.id) ? idx : max),
          -1
        );
        const outOfOrder = pending.filter(
          m => this.migrations.indexOf(m) < lastAppliedIndex
        );
        if (outOfOrder.length > 0) {
          throw new MigrationDriftError(
            outOfOrder.map(
              m =>
                `${m.id} is pending but sorts before migrations that are already ` +
                "applied. Baseline it if the database already has it, or rerun " +
                "with --allow-out-of-order after checking it is safe"
            )
          );
        }
      }

      if (options.dryRun) {
        return { applied: [], pending: pending.map(m => m.id) };
      }

      const done: string[] = [];
      for (const migration of pending) {
        this.log(`Applying ${migration.id}...`);
        if (migration.transactional) {
          await this.applyTransactional(migration);
        } else {
          await this.applyNonTransactional(migration);
        }
        done.push(migration.id);
      }
      return { applied: done, pending: [] };
    });
  }

  private async applyTransactional(migration: Migration): Promise<void> {
    const started = Date.now();
    await this.client.query("BEGIN");
    try {
      await this.client.query(migration.sql);
      await this.client.query(
        `INSERT INTO schema_migrations
           (version, file, kind, checksum, status, transactional, execution_ms, applied_by)
         VALUES ($1, $2, $3, $4, 'applied', TRUE, $5, $6)`,
        [
          migration.id,
          migration.file,
          migration.kind,
          migration.checksum,
          Date.now() - started,
          this.appliedBy,
        ]
      );
      await this.client.query("COMMIT");
    } catch (error) {
      await this.client.query("ROLLBACK").catch(() => undefined);
      throw new MigrationExecutionError(migration.id, error);
    }
  }

  /**
   * Statements that cannot run in a transaction block are executed one at a
   * time. The row is written as `running` first, so a crash half way through
   * leaves an explicit marker that blocks further runs until an operator
   * inspects the database and calls `resolve`.
   */
  private async applyNonTransactional(migration: Migration): Promise<void> {
    const started = Date.now();
    await this.client.query(
      `INSERT INTO schema_migrations
         (version, file, kind, checksum, status, transactional, applied_by)
       VALUES ($1, $2, $3, $4, 'running', FALSE, $5)`,
      [
        migration.id,
        migration.file,
        migration.kind,
        migration.checksum,
        this.appliedBy,
      ]
    );
    try {
      for (const statement of splitSqlStatements(migration.sql)) {
        await this.client.query(statement);
      }
    } catch (error) {
      await this.client.query(
        `UPDATE schema_migrations SET status = 'failed', error = $2,
           execution_ms = $3 WHERE version = $1`,
        [
          migration.id,
          (error instanceof Error ? error.message : String(error)).slice(
            0,
            2000
          ),
          Date.now() - started,
        ]
      );
      throw new MigrationExecutionError(migration.id, error);
    }
    await this.client.query(
      `UPDATE schema_migrations SET status = 'applied', execution_ms = $2,
         applied_at = NOW() WHERE version = $1`,
      [migration.id, Date.now() - started]
    );
  }

  /**
   * Records legacy migrations as already present without executing them.
   * Every selected migration's probe must pass (unless forced), and either
   * all selected rows are written or none are.
   */
  async baseline(options: {
    through?: string;
    only?: string[];
    allLegacy?: boolean;
    force?: boolean;
    dryRun?: boolean;
  }): Promise<{ recorded: string[]; skipped: string[] }> {
    const legacy = this.migrations.filter(m => m.kind === "legacy");
    let selected: Migration[];

    if (options.allLegacy) {
      selected = legacy;
    } else if (options.through) {
      const idx = legacy.findIndex(m => m.id === options.through);
      if (idx === -1) {
        throw new MigrationDriftError([
          `${options.through} is not a legacy migration and cannot be baselined`,
        ]);
      }
      selected = legacy.slice(0, idx + 1);
    } else if (options.only && options.only.length > 0) {
      const unknown = options.only.filter(id => !legacy.some(m => m.id === id));
      if (unknown.length > 0) {
        throw new MigrationDriftError(
          unknown.map(
            id => `${id} is not a legacy migration and cannot be baselined`
          )
        );
      }
      selected = legacy.filter(m => options.only!.includes(m.id));
    } else {
      throw new MigrationDriftError([
        "baseline needs --all-legacy, --through <id> or --only <id,...>",
      ]);
    }

    return this.withLock(async () => {
      await this.ensureTrackingTable();
      const applied = await this.readApplied();
      const problems = this.findDrift(applied);
      if (problems.length > 0) {
        throw new MigrationDriftError(problems);
      }

      const recordedIds = new Set(applied.map(r => r.version));
      const toRecord = selected.filter(m => !recordedIds.has(m.id));
      const skipped = selected
        .filter(m => recordedIds.has(m.id))
        .map(m => m.id);

      const probeFailures: string[] = [];
      for (const migration of toRecord) {
        const { rows } = await this.client.query(
          `SELECT (${migration.probe}) AS ok`
        );
        if (rows[0]?.ok !== true) {
          probeFailures.push(
            `${migration.id}: schema probe failed, so this database does not ` +
              "appear to have it. Apply it with `up` instead, or pass --force " +
              "if you have verified it by hand"
          );
        }
      }
      if (probeFailures.length > 0 && !options.force) {
        throw new MigrationDriftError(probeFailures);
      }

      if (options.dryRun) {
        return { recorded: toRecord.map(m => m.id), skipped };
      }

      await this.client.query("BEGIN");
      try {
        for (const migration of toRecord) {
          await this.client.query(
            `INSERT INTO schema_migrations
               (version, file, kind, checksum, status, transactional, applied_by)
             VALUES ($1, $2, 'legacy', $3, 'baselined', $4, $5)`,
            [
              migration.id,
              migration.file,
              migration.checksum,
              migration.transactional,
              `baseline:${this.appliedBy}`,
            ]
          );
        }
        await this.client.query("COMMIT");
      } catch (error) {
        await this.client.query("ROLLBACK").catch(() => undefined);
        throw error;
      }

      return { recorded: toRecord.map(m => m.id), skipped };
    });
  }

  /**
   * Clears a `failed`/`running` marker after an operator has inspected the
   * database: `applied` when the migration's effects are fully present,
   * `rolled-back` when they have been undone and the migration should rerun.
   */
  async resolve(
    version: string,
    outcome: "applied" | "rolled-back"
  ): Promise<void> {
    await this.withLock(async () => {
      await this.ensureTrackingTable();
      const { rows } = await this.client.query(
        "SELECT status FROM schema_migrations WHERE version = $1",
        [version]
      );
      const status = rows[0]?.status as MigrationStatus | undefined;
      if (status !== "failed" && status !== "running") {
        throw new MigrationDriftError([
          `${version} is ${status ?? "not recorded"}; only failed or running migrations can be resolved`,
        ]);
      }
      if (outcome === "applied") {
        await this.client.query(
          `UPDATE schema_migrations SET status = 'applied',
             error = NULL, applied_by = $2 WHERE version = $1`,
          [version, `resolve:${this.appliedBy}`]
        );
      } else {
        await this.client.query(
          "DELETE FROM schema_migrations WHERE version = $1",
          [version]
        );
      }
    });
  }
}

function stripLeadingComments(statement: string): string {
  return statement.replace(/^(\s*(--[^\n]*\n|\/\*[\s\S]*?\*\/))*/, "").trim();
}
