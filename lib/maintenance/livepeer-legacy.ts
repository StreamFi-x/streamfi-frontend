/**
 * Read-only audit of what the Livepeer → Mux migration left behind.
 *
 * Livepeer identifiers cannot be translated into Mux identifiers, so no row
 * can be "repaired" by copying one column into another. Every legacy value is
 * classified, archived to `legacy_livepeer_refs` and only then dropped by
 * db/migrations/20260925190100_retire_livepeer_columns.sql, which applies the same
 * rules as `classifyLegacyValue` below. docs/livepeer-mux-audit.md records the
 * dispositions.
 */

export type LegacyTable = "users" | "stream_sessions";

export interface LegacyColumn {
  table: LegacyTable;
  column: string;
  /** The Mux column that superseded it, if one exists. */
  muxColumn: string;
}

export const LEGACY_COLUMNS: readonly LegacyColumn[] = [
  { table: "users", column: "livepeer_stream_id", muxColumn: "mux_stream_id" },
  { table: "users", column: "playback_id", muxColumn: "mux_playback_id" },
  {
    table: "stream_sessions",
    column: "livepeer_session_id",
    muxColumn: "mux_session_id",
  },
  {
    table: "stream_sessions",
    column: "livepeer_stream_id",
    muxColumn: "mux_session_id",
  },
];

/** Names used by schema.sql and by the old /api/debug/fix-db route. */
export const LEGACY_INDEXES: readonly string[] = [
  "idx_users_livepeer_stream_id",
  "idx_users_livepeer",
  "idx_users_playback_id",
  "idx_stream_sessions_livepeer_session",
];

/**
 * - migrated: the row also carries a Mux reference; the legacy value is dead.
 * - unprovisioned: a creator with a Livepeer stream and no Mux stream yet. The
 *   existing /api/streams/create flow provisions Mux on their next go-live, so
 *   nothing is hidden or lost; the old ID is archived.
 * - legacy_history: a stream session recorded under Livepeer. Kept for
 *   analytics and chat history; it was never playable through Mux.
 */
export type LegacyDisposition = "migrated" | "unprovisioned" | "legacy_history";

export function classifyLegacyValue(
  table: LegacyTable,
  legacyValue: string | null | undefined,
  muxValue: string | null | undefined
): LegacyDisposition | "clean" {
  if (!legacyValue) {
    return "clean";
  }
  if (muxValue) {
    return "migrated";
  }
  return table === "users" ? "unprovisioned" : "legacy_history";
}

export type AuditQuery = (
  text: string,
  params?: unknown[]
) => Promise<{ rows: Record<string, unknown>[] }>;

export interface ColumnAudit extends LegacyColumn {
  present: boolean;
  nullable: boolean | null;
  totalRows: number;
  nonNull: number;
  byDisposition: Record<LegacyDisposition, number>;
}

export interface IndexAudit {
  name: string;
  table: string;
  definition: string;
}

export interface LivepeerAuditReport {
  columns: ColumnAudit[];
  indexes: IndexAudit[];
  archivedRows: number | null;
}

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

export async function auditLivepeerLegacy(
  query: AuditQuery
): Promise<LivepeerAuditReport> {
  const tables = [...new Set(LEGACY_COLUMNS.map(c => c.table))];
  const { rows: columnRows } = await query(
    `SELECT table_name, column_name, is_nullable
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = ANY($1)`,
    [tables]
  );
  const present = new Map(
    columnRows.map(r => [
      `${r.table_name}.${r.column_name}`,
      r.is_nullable === "YES",
    ])
  );

  const columns: ColumnAudit[] = [];
  for (const col of LEGACY_COLUMNS) {
    const key = `${col.table}.${col.column}`;
    const audit: ColumnAudit = {
      ...col,
      present: present.has(key),
      nullable: present.has(key) ? (present.get(key) ?? null) : null,
      totalRows: 0,
      nonNull: 0,
      byDisposition: { migrated: 0, unprovisioned: 0, legacy_history: 0 },
    };
    if (audit.present) {
      // Identifiers come from the constant list above, never from input.
      const legacy = quoteIdent(col.column);
      const mux = present.has(`${col.table}.${col.muxColumn}`)
        ? quoteIdent(col.muxColumn)
        : "NULL";
      const { rows } = await query(
        `SELECT COUNT(*)::int AS total,
                COUNT(${legacy})::int AS non_null,
                COUNT(*) FILTER (WHERE ${legacy} IS NOT NULL AND ${legacy} <> ''
                                   AND ${mux} IS NOT NULL AND ${mux} <> '')::int AS migrated,
                COUNT(*) FILTER (WHERE ${legacy} IS NOT NULL AND ${legacy} <> ''
                                   AND (${mux} IS NULL OR ${mux} = ''))::int AS orphaned
           FROM ${quoteIdent(col.table)}`
      );
      const r = rows[0];
      audit.totalRows = Number(r.total);
      audit.nonNull = Number(r.non_null);
      audit.byDisposition.migrated = Number(r.migrated);
      audit.byDisposition[
        col.table === "users" ? "unprovisioned" : "legacy_history"
      ] = Number(r.orphaned);
    }
    columns.push(audit);
  }

  const { rows: indexRows } = await query(
    `SELECT indexname, tablename, indexdef
       FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename <> 'legacy_livepeer_refs'
        AND (indexname = ANY($1) OR indexdef ~* 'livepeer')`,
    [LEGACY_INDEXES]
  );
  const indexes = indexRows.map(r => ({
    name: String(r.indexname),
    table: String(r.tablename),
    definition: String(r.indexdef),
  }));

  const { rows: archiveTable } = await query(
    `SELECT to_regclass('legacy_livepeer_refs') IS NOT NULL AS present`
  );
  let archivedRows: number | null = null;
  if (archiveTable[0]?.present) {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS n FROM legacy_livepeer_refs`
    );
    archivedRows = Number(rows[0].n);
  }

  return { columns, indexes, archivedRows };
}
