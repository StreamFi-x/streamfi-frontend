/**
 * Real-PostgreSQL helpers for integration tests.
 *
 * Tests that need a database run only when TEST_DATABASE_URL points at a
 * disposable PostgreSQL instance (CI provides one as a service container).
 * Each test gets its own schema, so runs never see each other's tables.
 */
import { Client, Pool } from "pg";

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

export const describeWithDb: jest.Describe = TEST_DATABASE_URL
  ? describe
  : describe.skip;

export interface TestSchema {
  name: string;
  pool: Pool;
  connect(): Promise<Client>;
  drop(): Promise<void>;
}

let counter = 0;

export async function createTestSchema(prefix: string): Promise<TestSchema> {
  if (!TEST_DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL is not set");
  }
  counter += 1;
  const name = `t_${prefix}_${process.pid}_${Date.now()}_${counter}`
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_");

  const admin = new Client({ connectionString: TEST_DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE SCHEMA "${name}"`);
  await admin.end();

  const options = `-c search_path="${name}",public`;
  const pool = new Pool({
    connectionString: TEST_DATABASE_URL,
    options,
    max: 20,
  });

  return {
    name,
    pool,
    async connect() {
      const client = new Client({
        connectionString: TEST_DATABASE_URL,
        options,
      });
      await client.connect();
      return client;
    },
    async drop() {
      await pool.end();
      const cleanup = new Client({ connectionString: TEST_DATABASE_URL });
      await cleanup.connect();
      await cleanup.query(`DROP SCHEMA IF EXISTS "${name}" CASCADE`);
      await cleanup.end();
    },
  };
}

/** Adapts a pg Pool to the `(text, params) => { rows, rowCount }` executor. */
export function poolExecutor(pool: Pool) {
  return async (text: string, params: unknown[] = []) => {
    const result = await pool.query(text, params);
    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
  };
}
