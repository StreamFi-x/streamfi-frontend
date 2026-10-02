/**
 * @jest-environment node
 *
 * The shared cursor contract (lib/pagination/cursor.ts) against a real
 * PostgreSQL: the same query shape every paginated route runs, with the same
 * cursor encoding, microsecond timestamps, ties and concurrent writers.
 * Runs when TEST_DATABASE_URL is set (CI provides one).
 */
import {
  buildPage,
  decodeCursor,
  keysetBounds,
  type KeysetRow,
} from "@/lib/pagination/cursor";
import {
  createTestSchema,
  describeWithDb,
  type TestSchema,
} from "@/test-utils/pg-test-db";

// The route SQL, with the tagged-template parameters written as $n.
const PAGE_SQL = `
  SELECT
    id,
    to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_ts
  FROM chat_messages
  WHERE stream_session_id = $1
    AND is_deleted = false
    AND (created_at, id) < ($2::timestamptz, $3::uuid)
  ORDER BY created_at DESC, id DESC
  LIMIT $4
`;

const SESSION = "5e5510a0-0000-4000-8000-000000000001";

describeWithDb("keyset pagination on PostgreSQL", () => {
  let db: TestSchema;

  beforeAll(async () => {
    db = await createTestSchema("keyset");
    await db.pool.query(`
      CREATE TABLE chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        stream_session_id UUID NOT NULL,
        is_deleted BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX ON chat_messages (stream_session_id, created_at DESC)
        WHERE is_deleted = false;
    `);
  });

  afterAll(async () => {
    await db?.drop();
  });

  beforeEach(async () => {
    await db.pool.query("TRUNCATE chat_messages");
  });

  async function fetchPage(cursor: string | null, limit: number) {
    const bound = keysetBounds(cursor ? decodeCursor(cursor) : null);
    const { rows } = await db.pool.query<KeysetRow>(PAGE_SQL, [
      SESSION,
      bound.ts,
      bound.id,
      limit + 1,
    ]);
    return buildPage(rows, limit, r => r.id);
  }

  async function drain(limit: number, afterEachPage?: () => Promise<void>) {
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page = await fetchPage(cursor, limit);
      seen.push(...page.items);
      cursor = page.nextCursor;
      pages += 1;
      if (pages > 10_000) {
        throw new Error("pagination did not terminate");
      }
      await afterEachPage?.();
    } while (cursor);
    return seen;
  }

  async function allIdsInOrder(): Promise<string[]> {
    const { rows } = await db.pool.query<{ id: string }>(
      `SELECT id FROM chat_messages
       WHERE stream_session_id = $1 AND is_deleted = false
       ORDER BY created_at DESC, id DESC`,
      [SESSION]
    );
    return rows.map(r => r.id);
  }

  it("returns every row exactly once, in order, through heavy timestamp ties", async () => {
    // 2,000 rows in 20 distinct microseconds: 100 rows share each timestamp.
    await db.pool.query(
      `INSERT INTO chat_messages (stream_session_id, created_at)
       SELECT $1, TIMESTAMPTZ '2026-09-25 10:00:00.000001+00' + (g % 20) * INTERVAL '1 microsecond'
       FROM generate_series(1, 2000) g`,
      [SESSION]
    );

    const seen = await drain(37);

    expect(seen).toEqual(await allIdsInOrder());
    expect(new Set(seen).size).toBe(2000);
  });

  it("keeps rows one microsecond apart on the right side of a page boundary", async () => {
    await db.pool.query(
      `INSERT INTO chat_messages (stream_session_id, created_at)
       SELECT $1, TIMESTAMPTZ '2026-09-25 10:00:00.123456+00' + g * INTERVAL '1 microsecond'
       FROM generate_series(0, 99) g`,
      [SESSION]
    );

    expect(await drain(1)).toEqual(await allIdsInOrder());
  });

  it("neither repeats nor skips rows while another writer inserts", async () => {
    await db.pool.query(
      `INSERT INTO chat_messages (stream_session_id, created_at)
       SELECT $1, TIMESTAMPTZ '2026-09-25 09:00:00+00' + (g / 3) * INTERVAL '1 millisecond'
       FROM generate_series(1, 600) g`,
      [SESSION]
    );
    const initial = new Set(await allIdsInOrder());

    // After every page, a concurrent chat burst lands at the head of the list:
    // 10 rows sharing one timestamp, newer than anything already paged.
    let burst = 0;
    const seen = await drain(25, async () => {
      burst += 1;
      await db.pool.query(
        `INSERT INTO chat_messages (stream_session_id, created_at)
         SELECT $1, TIMESTAMPTZ '2026-09-25 12:00:00+00' + $2 * INTERVAL '1 second'
         FROM generate_series(1, 10)`,
        [SESSION, burst]
      );
    });

    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.filter(id => initial.has(id))).toHaveLength(initial.size);
    // Rows inserted after the first page are newer than every cursor issued,
    // so they never shift into later pages (OFFSET would repeat rows here).
    expect(seen.filter(id => !initial.has(id))).toEqual([]);
  });

  it("skips soft-deleted rows without breaking the cursor chain", async () => {
    await db.pool.query(
      `INSERT INTO chat_messages (stream_session_id, created_at, is_deleted)
       SELECT $1, TIMESTAMPTZ '2026-09-25 10:00:00+00' + g * INTERVAL '1 millisecond', g % 4 = 0
       FROM generate_series(1, 200) g`,
      [SESSION]
    );

    const seen = await drain(9);

    expect(seen).toEqual(await allIdsInOrder());
    expect(seen).toHaveLength(150);
  });
});
