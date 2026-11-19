/**
 * @jest-environment node
 *
 * Runs against a real PostgreSQL instance (TEST_DATABASE_URL).
 */
import type { Client } from "pg";
import {
  checksumSql,
  isTransactional,
  Migration,
} from "@/lib/migrations/discovery";
import {
  MigrationDriftError,
  MigrationExecutionError,
  MigrationLockTimeoutError,
  MigrationRunner,
} from "@/lib/migrations/runner";
import {
  createTestSchema,
  describeWithDb,
  TestSchema,
} from "@/test-utils/pg-test-db";

jest.setTimeout(30_000);

function versioned(id: string, sql: string): Migration {
  return {
    id,
    file: `${id}.sql`,
    kind: "versioned",
    checksum: checksumSql(sql),
    sql,
    transactional: isTransactional(sql),
  };
}

function legacy(id: string, sql: string, probe: string): Migration {
  return { ...versioned(id, sql), kind: "legacy", probe };
}

let lockKeySeed = 910_000;

describeWithDb("MigrationRunner (PostgreSQL)", () => {
  let schema: TestSchema;
  let clients: Client[];
  let lockKey: string;

  beforeEach(async () => {
    schema = await createTestSchema("migrations");
    clients = [];
    lockKeySeed += 1;
    lockKey = String(lockKeySeed);
  });

  afterEach(async () => {
    await Promise.all(clients.map(c => c.end().catch(() => undefined)));
    await schema.drop();
  });

  async function runner(
    migrations: Migration[],
    extra: Partial<ConstructorParameters<typeof MigrationRunner>[0]> = {}
  ) {
    const client = await schema.connect();
    clients.push(client);
    return {
      client,
      runner: new MigrationRunner({
        client,
        migrations,
        lockKey,
        appliedBy: "jest",
        existingSchemaSentinel: "app_users",
        ...extra,
      }),
    };
  }

  async function tracked(): Promise<Array<Record<string, unknown>>> {
    const { rows } = await schema.pool.query(
      "SELECT version, status, kind, checksum, transactional FROM schema_migrations ORDER BY applied_at, version"
    );
    return rows;
  }

  const first = versioned(
    "20260101000001_create_widgets",
    "CREATE TABLE widgets (id SERIAL PRIMARY KEY, name TEXT);"
  );
  const second = versioned(
    "20260101000002_add_widget_colour",
    "ALTER TABLE widgets ADD COLUMN colour TEXT;"
  );

  it("applies pending migrations in order on a clean database and records them", async () => {
    const { runner: r } = await runner([first, second]);

    const result = await r.up();

    expect(result.applied).toEqual([first.id, second.id]);
    const rows = await tracked();
    expect(rows.map(row => row.version)).toEqual([first.id, second.id]);
    expect(rows.every(row => row.status === "applied")).toBe(true);
    expect(String(rows[0].checksum)).toBe(first.checksum);
    const { rows: cols } = await schema.pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'widgets' ORDER BY ordinal_position",
      [schema.name]
    );
    expect(cols.map(c => c.column_name)).toEqual(["id", "name", "colour"]);
  });

  it("skips already-applied migrations on the next run", async () => {
    const { runner: r } = await runner([first, second]);
    await r.up();

    const again = await r.up();

    expect(again.applied).toEqual([]);
    expect(await tracked()).toHaveLength(2);
  });

  it("applies only the new migration when one is added later", async () => {
    await (await runner([first])).runner.up();

    const { runner: r } = await runner([first, second]);
    const result = await r.up();

    expect(result.applied).toEqual([second.id]);
  });

  it("supports a dry run without touching the schema", async () => {
    const { runner: r } = await runner([first, second]);

    const result = await r.up({ dryRun: true });

    expect(result.pending).toEqual([first.id, second.id]);
    const { rows } = await schema.pool.query(
      "SELECT to_regclass('widgets') IS NOT NULL AS present"
    );
    expect(rows[0].present).toBe(false);
  });

  it("fails loudly when an applied migration's file has changed", async () => {
    await (await runner([first])).runner.up();
    const edited = versioned(
      first.id,
      "CREATE TABLE widgets (id SERIAL PRIMARY KEY, name TEXT, extra INT);"
    );

    const { runner: r } = await runner([edited, second]);

    await expect(r.up()).rejects.toThrow(/changed after it was applied/);
    expect((await tracked()).map(row => row.version)).toEqual([first.id]);
    expect(await r.verify()).toEqual([
      expect.stringMatching(/changed after it was applied/),
    ]);
  });

  it("fails when a recorded migration's file is missing", async () => {
    await (await runner([first, second])).runner.up();

    const { runner: r } = await runner([first]);

    await expect(r.up()).rejects.toThrow(/file is missing/);
    expect(await r.status()).toContainEqual(
      expect.objectContaining({ id: second.id, state: "missing_file" })
    );
  });

  it("rolls back a failed transactional migration and does not record it", async () => {
    const broken = versioned(
      "20260101000003_broken",
      "CREATE TABLE gadgets (id INT);\nINSERT INTO does_not_exist VALUES (1);"
    );
    const later = versioned(
      "20260101000004_later",
      "CREATE TABLE later (id INT);"
    );
    const { runner: r } = await runner([first, broken, later]);

    await expect(r.up()).rejects.toBeInstanceOf(MigrationExecutionError);

    expect((await tracked()).map(row => row.version)).toEqual([first.id]);
    const { rows } = await schema.pool.query(
      "SELECT to_regclass('gadgets') IS NOT NULL AS gadgets, to_regclass('later') IS NOT NULL AS later"
    );
    expect(rows[0]).toEqual({ gadgets: false, later: false });
  });

  it("recovers after a failed migration is fixed", async () => {
    const broken = versioned("20260101000003_fixable", "SELECT * FROM nope;");
    await expect((await runner([first, broken])).runner.up()).rejects.toThrow(
      /20260101000003_fixable failed/
    );

    const fixed = versioned("20260101000003_fixable", "SELECT 1;");
    const result = await (await runner([first, fixed])).runner.up();

    expect(result.applied).toEqual([fixed.id]);
  });

  it("runs no-transaction migrations statement by statement", async () => {
    const concurrently = versioned(
      "20260101000003_widget_name_index",
      "-- migrate:no-transaction\nCREATE INDEX CONCURRENTLY idx_widgets_name ON widgets (name);\nCREATE INDEX CONCURRENTLY idx_widgets_id_name ON widgets (id, name);"
    );
    const { runner: r } = await runner([first, concurrently]);

    await r.up();

    const rows = await tracked();
    expect(rows[1]).toEqual(
      expect.objectContaining({ status: "applied", transactional: false })
    );
  });

  it("marks a failed no-transaction migration as failed and blocks until resolved", async () => {
    const bad = versioned(
      "20260101000003_bad_index",
      "-- migrate:no-transaction\nCREATE INDEX CONCURRENTLY idx_ok ON widgets (name);\nCREATE INDEX CONCURRENTLY idx_bad ON widgets (missing_column);"
    );
    const { runner: r } = await runner([first, bad]);

    await expect(r.up()).rejects.toBeInstanceOf(MigrationExecutionError);
    expect((await tracked())[1]).toEqual(
      expect.objectContaining({ version: bad.id, status: "failed" })
    );

    await expect(r.up()).rejects.toThrow(/is failed/);

    await schema.pool.query("DROP INDEX IF EXISTS idx_ok");
    await r.resolve(bad.id, "rolled-back");
    const fixed = versioned(
      bad.id,
      "-- migrate:no-transaction\nCREATE INDEX CONCURRENTLY idx_ok ON widgets (name);"
    );
    const result = await (await runner([first, fixed])).runner.up();
    expect(result.applied).toEqual([fixed.id]);
  });

  it("resolve only accepts failed or running migrations", async () => {
    const { runner: r } = await runner([first]);
    await r.up();

    await expect(r.resolve(first.id, "applied")).rejects.toThrow(
      /only failed or running/
    );
  });

  it("rejects transaction control inside transactional migrations", async () => {
    const withCommit = versioned(
      "20260101000003_commit",
      "BEGIN;\nCREATE TABLE x (id INT);\nCOMMIT;"
    );
    await expect(runner([withCommit])).rejects.toThrow(/transaction control/);
  });

  it("refuses to replay history on a database that has a schema but no history", async () => {
    await schema.pool.query("CREATE TABLE app_users (id INT)");
    const { runner: r } = await runner([first]);

    await expect(r.up()).rejects.toThrow(
      /Record the migrations it already has/
    );
    expect(await tracked()).toEqual([]);

    const forced = await r.up({ allowUnbaselined: true });
    expect(forced.applied).toEqual([first.id]);
  });

  it("detects pending migrations that sort before applied ones", async () => {
    await (await runner([first])).runner.up();
    const skipped = versioned(
      "20260101000000_zero",
      "CREATE TABLE zero (id INT);"
    );

    const { runner: r } = await runner([skipped, first]);

    await expect(r.up()).rejects.toThrow(
      /sorts before migrations that are already applied/
    );
    const result = await r.up({ allowOutOfOrder: true });
    expect(result.applied).toEqual([skipped.id]);
  });

  describe("concurrency", () => {
    it("serialises concurrent runners so each migration is applied exactly once", async () => {
      const slow = versioned(
        "20260101000001_slow_counter",
        "CREATE TABLE IF NOT EXISTS counter (n INT);\nSELECT pg_sleep(0.5);\nINSERT INTO counter VALUES (1);"
      );
      const runners = await Promise.all(
        Array.from({ length: 4 }, () => runner([slow], { lockPollMs: 50 }))
      );

      const results = await Promise.all(runners.map(({ runner: r }) => r.up()));

      expect(results.flatMap(res => res.applied)).toEqual([slow.id]);
      const { rows } = await schema.pool.query(
        "SELECT COUNT(*)::int AS n FROM counter"
      );
      expect(rows[0].n).toBe(1);
      expect(await tracked()).toHaveLength(1);
    });

    it("gives up with a lock timeout while another runner holds the lock", async () => {
      const holder = await schema.connect();
      clients.push(holder);
      await holder.query("SELECT pg_advisory_lock($1::bigint)", [lockKey]);

      const { runner: r } = await runner([first], {
        lockTimeoutMs: 300,
        lockPollMs: 50,
      });

      await expect(r.up()).rejects.toBeInstanceOf(MigrationLockTimeoutError);
      await holder.query("SELECT pg_advisory_unlock($1::bigint)", [lockKey]);
      expect((await r.up()).applied).toEqual([first.id]);
    });

    it("releases the lock when a migration fails", async () => {
      const broken = versioned("20260101000001_broken", "SELECT * FROM nope;");
      const { runner: r } = await runner([broken]);
      await expect(r.up()).rejects.toThrow();

      const other = await schema.connect();
      clients.push(other);
      const { rows } = await other.query(
        "SELECT pg_try_advisory_lock($1::bigint) AS locked",
        [lockKey]
      );
      expect(rows[0].locked).toBe(true);
    });
  });

  describe("baseline", () => {
    const legacyUsers = legacy(
      "add-app-users",
      "CREATE TABLE app_users (id INT);",
      "to_regclass('app_users') IS NOT NULL"
    );
    const legacyEmail = legacy(
      "add-app-users-email",
      "ALTER TABLE app_users ADD COLUMN email TEXT;",
      "EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'app_users' AND column_name = 'email')"
    );
    const next = versioned(
      "20260101000001_add_app_users_name",
      "ALTER TABLE app_users ADD COLUMN name TEXT;"
    );

    async function existingEnvironment() {
      await schema.pool.query("CREATE TABLE app_users (id INT, email TEXT)");
    }

    it("records legacy migrations without executing them, then up applies only newer ones", async () => {
      await existingEnvironment();
      const { runner: r } = await runner([legacyUsers, legacyEmail, next]);

      const baseline = await r.baseline({ allLegacy: true });

      expect(baseline.recorded).toEqual([legacyUsers.id, legacyEmail.id]);
      const rows = await tracked();
      expect(rows.map(row => row.status)).toEqual(["baselined", "baselined"]);

      const result = await r.up();
      expect(result.applied).toEqual([next.id]);
    });

    it("is safe to run twice", async () => {
      await existingEnvironment();
      const { runner: r } = await runner([legacyUsers, legacyEmail]);
      await r.baseline({ allLegacy: true });

      const second = await r.baseline({ allLegacy: true });

      expect(second.recorded).toEqual([]);
      expect(second.skipped).toEqual([legacyUsers.id, legacyEmail.id]);
      expect(await tracked()).toHaveLength(2);
    });

    it("refuses when a probe shows the schema is missing, writing nothing", async () => {
      await schema.pool.query("CREATE TABLE app_users (id INT)");
      const { runner: r } = await runner([legacyUsers, legacyEmail]);

      await expect(r.baseline({ allLegacy: true })).rejects.toThrow(
        /add-app-users-email: schema probe failed/
      );
      expect(await tracked()).toEqual([]);
    });

    it("can baseline a prefix and apply the rest", async () => {
      await schema.pool.query("CREATE TABLE app_users (id INT)");
      const { runner: r } = await runner([legacyUsers, legacyEmail, next]);

      await r.baseline({ through: legacyUsers.id });
      const result = await r.up();

      expect(result.applied).toEqual([legacyEmail.id, next.id]);
    });

    it("never baselines versioned migrations", async () => {
      const { runner: r } = await runner([legacyUsers, next]);
      await expect(r.baseline({ only: [next.id] })).rejects.toThrow(
        /not a legacy migration/
      );
    });

    it("dry run reports without writing", async () => {
      await existingEnvironment();
      const { runner: r } = await runner([legacyUsers, legacyEmail]);

      const result = await r.baseline({ allLegacy: true, dryRun: true });

      expect(result.recorded).toHaveLength(2);
      expect(await tracked()).toEqual([]);
    });

    it("up refuses when history is incomplete (legacy pending behind applied)", async () => {
      await existingEnvironment();
      const { runner: r } = await runner([legacyUsers, legacyEmail, next]);
      await r.baseline({ only: [legacyUsers.id] });
      await schema.pool.query(
        "INSERT INTO schema_migrations (version, file, kind, checksum, status, transactional) VALUES ($1, $2, 'versioned', $3, 'applied', TRUE)",
        [next.id, next.file, next.checksum]
      );

      await expect(r.up()).rejects.toThrow(MigrationDriftError);
    });
  });
});
