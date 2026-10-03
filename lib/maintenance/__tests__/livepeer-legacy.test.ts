/**
 * @jest-environment node
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, sep } from "path";
import {
  auditLivepeerLegacy,
  classifyLegacyValue,
  LEGACY_COLUMNS,
  type AuditQuery,
} from "../livepeer-legacy";

describe("classifyLegacyValue", () => {
  it.each([
    ["users", null, "mux", "clean"],
    ["users", "", null, "clean"],
    ["users", "lp-1", "mux-1", "migrated"],
    ["users", "lp-1", null, "unprovisioned"],
    ["users", "lp-1", "", "unprovisioned"],
    ["stream_sessions", "lp-s", "mux-s", "migrated"],
    ["stream_sessions", "lp-s", null, "legacy_history"],
  ] as const)("%s legacy=%p mux=%p -> %s", (table, legacy, mux, expected) => {
    expect(classifyLegacyValue(table, legacy, mux)).toBe(expected);
  });
});

describe("auditLivepeerLegacy", () => {
  function fakeCatalog(opts: {
    legacyPresent: boolean;
    archive: number | null;
  }) {
    const calls: string[] = [];
    const query: AuditQuery = async text => {
      calls.push(text);
      if (text.includes("information_schema.columns")) {
        const cols = [
          {
            table_name: "users",
            column_name: "mux_stream_id",
            is_nullable: "YES",
          },
          {
            table_name: "users",
            column_name: "mux_playback_id",
            is_nullable: "YES",
          },
          {
            table_name: "stream_sessions",
            column_name: "mux_session_id",
            is_nullable: "YES",
          },
        ];
        if (opts.legacyPresent) {
          cols.push(
            {
              table_name: "users",
              column_name: "livepeer_stream_id",
              is_nullable: "YES",
            },
            {
              table_name: "stream_sessions",
              column_name: "livepeer_session_id",
              is_nullable: "NO",
            }
          );
        }
        return { rows: cols };
      }
      if (text.includes('FROM "users"')) {
        return { rows: [{ total: 10, non_null: 4, migrated: 3, orphaned: 1 }] };
      }
      if (text.includes('FROM "stream_sessions"')) {
        return { rows: [{ total: 20, non_null: 5, migrated: 2, orphaned: 3 }] };
      }
      if (text.includes("pg_indexes")) {
        return {
          rows: opts.legacyPresent
            ? [
                {
                  indexname: "idx_users_livepeer_stream_id",
                  tablename: "users",
                  indexdef: "CREATE INDEX ... (livepeer_stream_id)",
                },
              ]
            : [],
        };
      }
      if (text.includes("to_regclass")) {
        return { rows: [{ present: opts.archive !== null }] };
      }
      if (text.includes("FROM legacy_livepeer_refs")) {
        return { rows: [{ n: opts.archive }] };
      }
      throw new Error(`unexpected: ${text}`);
    };
    return { query, calls };
  }

  it("reports aggregate dispositions for present columns only", async () => {
    const { query, calls } = fakeCatalog({
      legacyPresent: true,
      archive: null,
    });
    const report = await auditLivepeerLegacy(query);

    const users = report.columns.find(
      c => c.column === "livepeer_stream_id" && c.table === "users"
    )!;
    expect(users).toMatchObject({
      present: true,
      nullable: true,
      nonNull: 4,
      byDisposition: { migrated: 3, unprovisioned: 1, legacy_history: 0 },
    });
    const sessions = report.columns.find(
      c => c.column === "livepeer_session_id"
    )!;
    expect(sessions).toMatchObject({
      present: true,
      nullable: false,
      byDisposition: { migrated: 2, unprovisioned: 0, legacy_history: 3 },
    });
    expect(report.columns.find(c => c.column === "playback_id")!.present).toBe(
      false
    );
    expect(report.indexes.map(i => i.name)).toEqual([
      "idx_users_livepeer_stream_id",
    ]);
    expect(report.archivedRows).toBeNull();
    // Only aggregates are read: never row-level identifiers.
    expect(
      calls.every(q => !/SELECT\s+\*|SELECT\s+id\b|wallet|username/i.test(q))
    ).toBe(true);
  });

  it("reports a clean database after the migration", async () => {
    const { query } = fakeCatalog({ legacyPresent: false, archive: 9 });
    const report = await auditLivepeerLegacy(query);
    expect(report.columns.every(c => !c.present)).toBe(true);
    expect(report.indexes).toEqual([]);
    expect(report.archivedRows).toBe(9);
  });
});

/**
 * Codebase-wide confirmation for #1408: nothing outside the retirement tooling
 * reads or writes the dropped columns. `playback_id` is excluded because
 * stream_sessions.playback_id and stream_recordings.playback_id are live Mux
 * columns; users.playback_id is covered by the `users`-qualified pattern.
 */
describe("no code path depends on the retired Livepeer columns", () => {
  const ROOT = join(__dirname, "..", "..", "..");
  const ALLOWED = new Set([
    "lib/maintenance/livepeer-legacy.ts",
    "scripts/audit-livepeer-legacy.ts",
    // Conditionally drops NOT NULL on stream_sessions.livepeer_stream_id for
    // databases that have not run the retirement migration yet.
    "app/api/debug/migrate-chat/route.ts",
  ]);

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap(name => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        return ["node_modules", ".next", "__tests__"].includes(name)
          ? []
          : walk(full);
      }
      return /\.(ts|tsx|js|mjs|cjs)$/.test(name) ? [full] : [];
    });
  }

  it("finds no references outside the allowlist", () => {
    const pattern = new RegExp(
      [
        ...LEGACY_COLUMNS.filter(c => c.column !== "playback_id").map(
          c => c.column
        ),
        "users\\.playback_id",
        "LIVEPEER_API_KEY",
      ].join("|"),
      "i"
    );
    const offenders = [
      "app",
      "lib",
      "hooks",
      "components",
      "utils",
      "scripts",
      "types",
    ]
      .flatMap(d => walk(join(ROOT, d)))
      .map(f => ({
        path: relative(ROOT, f).split(sep).join("/"),
        text: readFileSync(f, "utf8"),
      }))
      .filter(f => !ALLOWED.has(f.path) && pattern.test(f.text))
      .map(f => f.path);
    expect(offenders).toEqual([]);
  });

  it("db/schema.sql no longer indexes the dropped columns", () => {
    const schema = readFileSync(join(ROOT, "db", "schema.sql"), "utf8");
    expect(schema).not.toMatch(
      /ON users\(livepeer_stream_id\)|ON users\(playback_id\)/
    );
    expect(schema).not.toMatch(/livepeer_session_id\)/);
  });
});
