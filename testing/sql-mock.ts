/**
 * Test helper: a stand-in for @vercel/postgres `sql` that routes each query to
 * a handler by matching its text. Lives outside __tests__ so Jest does not
 * collect it as a suite.
 *
 *   const mockDb = createSqlMock();
 *   jest.mock("@vercel/postgres", () => ({
 *     sql: (...args: unknown[]) => mockDb.sql(...args),
 *   }));
 *   mockDb.on(/FROM users/, { rows: [...] });
 */
export interface SqlCall {
  text: string;
  values: unknown[];
}

export interface SqlResult {
  rows?: Record<string, unknown>[];
  rowCount?: number;
}

type Handler = SqlResult | ((call: SqlCall) => SqlResult | Promise<SqlResult>);

interface Route {
  pattern: RegExp;
  handler: Handler;
}

export function createSqlMock() {
  const onceRoutes: Route[] = [];
  const routes: Route[] = [];
  const calls: SqlCall[] = [];

  async function sql(...args: unknown[]) {
    const [strings, ...values] = args as [TemplateStringsArray, ...unknown[]];
    const text = strings.join("$?").replace(/\s+/g, " ").trim();
    const call = { text, values };
    calls.push(call);

    const onceIndex = onceRoutes.findIndex(r => r.pattern.test(text));
    const route =
      onceIndex >= 0
        ? onceRoutes.splice(onceIndex, 1)[0]
        : routes.find(r => r.pattern.test(text));
    if (!route) {
      throw new Error(`Unexpected SQL in test: ${text.slice(0, 160)}`);
    }
    const result =
      typeof route.handler === "function"
        ? await route.handler(call)
        : route.handler;
    const rows = result.rows ?? [];
    return { rows, rowCount: result.rowCount ?? rows.length };
  }

  return {
    sql,
    calls,
    /** Persistent route (checked after one-shot routes). */
    on(pattern: RegExp, handler: Handler) {
      routes.push({ pattern, handler });
    },
    /** One-shot route, consumed by the first matching query. */
    once(pattern: RegExp, handler: Handler) {
      onceRoutes.push({ pattern, handler });
    },
    callsMatching(pattern: RegExp): SqlCall[] {
      return calls.filter(c => pattern.test(c.text));
    },
    reset() {
      onceRoutes.length = 0;
      routes.length = 0;
      calls.length = 0;
    },
  };
}
