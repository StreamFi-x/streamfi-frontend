import { sql } from "@vercel/postgres";

export interface QueryResultLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[];
  rowCount: number;
}

/**
 * Parameterised query function. Production code uses the shared
 * `@vercel/postgres` pool; integration tests pass a `pg` pool against a real
 * PostgreSQL instance so the concurrency-critical statements are exercised
 * for real rather than against mocks.
 */
export type SqlExecutor = (
  text: string,
  params?: unknown[]
) => Promise<QueryResultLike>;

export const defaultExecutor: SqlExecutor = async (text, params = []) => {
  const result = await sql.query(
    text,
    params as Parameters<typeof sql.query>[1]
  );
  return { rows: result.rows, rowCount: result.rowCount ?? 0 };
};
