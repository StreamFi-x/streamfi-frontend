import { db, type VercelPoolClient } from "@vercel/postgres";

/** The subset of a pooled client that transactional code may use. */
export type Tx = Pick<VercelPoolClient, "sql">;

/**
 * Runs `fn` inside a single Postgres transaction on one pooled connection.
 *
 * The module-level `sql` tag from @vercel/postgres may use a different
 * connection per statement, so `BEGIN`/`COMMIT` issued through it do not form
 * a transaction. Anything that needs atomicity must go through this helper.
 */
export async function withTransaction<T>(
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  const client = await db.connect();
  let discardConnection = false;
  try {
    await client.sql`BEGIN`;
    const result = await fn(client);
    await client.sql`COMMIT`;
    return result;
  } catch (err) {
    try {
      await client.sql`ROLLBACK`;
    } catch {
      // The original error is the useful one. A connection that cannot even
      // roll back is destroyed instead of being returned to the pool.
      discardConnection = true;
    }
    throw err;
  } finally {
    client.release(discardConnection);
  }
}
