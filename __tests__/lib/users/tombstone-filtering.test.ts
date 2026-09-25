/**
 * @jest-environment node
 *
 * Guard for #1406: every SQL query that reads `users` must either exclude
 * tombstoned accounts (`deleted_at IS NULL`) or say why it must not, with a
 * `-- tombstone-aware: <reason>` comment inside the query. Files whose every
 * query is internal (admin, audit, webhooks, jobs) are listed below with the
 * reason. A new query that does neither fails this test.
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../../..");
const SCANNED_DIRS = ["app", "lib", "utils"];

const INTERNAL_FILES: Record<string, string> = {
  "app/api/admin/analytics/route.ts": "admin view counts all accounts",
  "app/api/auth/session/route.ts":
    "sign-in bootstrap; tombstoned users sign in to cancel their deletion",
  "app/api/auth/wallet-session/route.ts":
    "sign-in bootstrap; tombstoned users sign in to cancel their deletion",
  "app/api/debug/clear-users/route.ts": "secret-guarded dev tool",
  "app/api/debug/fix-db/route.ts": "secret-less dev schema tool",
  "app/api/debug/user-stream/route.ts": "dev diagnostics",
  "app/api/webhooks/mux/route.ts":
    "provider events must be recorded for every account",
  "lib/db/jsonb-audit.ts": "audits every row",
  "lib/users/deletion.ts": "manages the deletion lifecycle itself",
  "lib/mux/reconciliation.ts": "reconciles assets of every account",
  "lib/stellar/tip-reconciliation.ts": "financial reconciliation",
  "lib/routes-f/badges.ts": "internal lookup by id",
};

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" || entry.name === "node_modules"
        ? []
        : sourceFiles(full);
    }
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)
      ? [full]
      : [];
  });
}

function usersQueries(source: string): Array<{ line: number; text: string }> {
  // Ignore commented-out code.
  const code = source
    .split("\n")
    .map(line => (/^\s*\/\//.test(line) ? "" : line))
    .join("\n");
  const queries: Array<{ line: number; text: string }> = [];
  const template = /sql`([\s\S]*?)`/g;
  let match: RegExpExecArray | null;
  while ((match = template.exec(code))) {
    if (/\b(from|join)\s+users\b/i.test(match[1])) {
      queries.push({
        line: code.slice(0, match.index).split("\n").length,
        text: match[1],
      });
    }
  }
  return queries;
}

describe("tombstoned users are filtered from user-facing reads", () => {
  const files = SCANNED_DIRS.flatMap(d => sourceFiles(path.join(ROOT, d))).map(
    f => path.relative(ROOT, f).split(path.sep).join("/")
  );

  it("finds the query sites it is meant to guard", () => {
    const withQueries = files.filter(
      f => usersQueries(fs.readFileSync(path.join(ROOT, f), "utf8")).length
    );
    expect(withQueries.length).toBeGreaterThan(40);
  });

  it("every users query filters deleted_at or documents why not", () => {
    const violations = files
      .filter(f => !(f in INTERNAL_FILES))
      .flatMap(f =>
        usersQueries(fs.readFileSync(path.join(ROOT, f), "utf8"))
          .filter(
            q => !/deleted_at/.test(q.text) && !/tombstone-aware:/.test(q.text)
          )
          .map(q => `${f}:${q.line}`)
      );
    expect(violations).toEqual([]);
  });

  it("has no stale entries in the internal allowlist", () => {
    const stale = Object.keys(INTERNAL_FILES).filter(f => !files.includes(f));
    expect(stale).toEqual([]);
  });
});
