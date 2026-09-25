import { db, type VercelPoolClient } from "@vercel/postgres";

/**
 * Runs `fn` as one real transaction on a pooled connection.
 *
 * The top-level `sql` tag sends every statement as its own HTTP request
 * (Neon's HTTP driver), so `sql\`BEGIN\`` ... `sql\`COMMIT\`` is not a
 * transaction. A client checked out with `db.connect()` holds one pooler
 * connection until it is released, which is exactly what transaction-mode
 * PgBouncer supports. Unlike `createClient()`, it never opens a direct,
 * non-pooled Postgres connection per request. See
 * docs/postgres-pooling-and-chat-load.md.
 */
export async function withTransaction<T>(
  fn: (client: VercelPoolClient) => Promise<T>
): Promise<T> {
  const client = await db.connect();
  let releaseError: Error | undefined;
  try {
    await client.sql`BEGIN`;
    try {
      const result = await fn(client);
      await client.sql`COMMIT`;
      return result;
    } catch (err) {
      try {
        await client.sql`ROLLBACK`;
      } catch (rollbackErr) {
        // A connection that cannot roll back must not go back to the pool.
        releaseError = rollbackErr as Error;
      }
      throw err;
    }
  } finally {
    client.release(releaseError);
  }
}
