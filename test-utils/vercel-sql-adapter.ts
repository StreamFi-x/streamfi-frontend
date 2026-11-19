/**
 * Implements the `sql` export of @vercel/postgres on top of a `pg` pool so
 * unmodified route handlers can run against a real PostgreSQL instance:
 *
 *   jest.mock("@vercel/postgres", () => ({ sql: Object.assign(jest.fn(), { query: jest.fn() }) }));
 *   bindVercelSql(sql as never, pool);
 */
import type { Pool } from "pg";

interface MockableSql {
  mockImplementation: (fn: (...args: never[]) => unknown) => void;
  query: { mockImplementation: (fn: (...args: never[]) => unknown) => void };
}

export function bindVercelSql(sqlMock: MockableSql, pool: Pool): void {
  sqlMock.mockImplementation(((
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => {
    const text = strings.reduce(
      (acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ""),
      ""
    );
    return pool.query(text, values);
  }) as never);
  sqlMock.query.mockImplementation(((text: string, params: unknown[] = []) =>
    pool.query(text, params)) as never);
}
