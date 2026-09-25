/**
 * GET /api/routes-f/backfill-status?table=watch_history
 *
 * Returns the current status of backfill jobs for analytics tables.
 * Useful for monitoring backfill progress and checking for errors.
 *
 * Query params:
 *   table?: "watch_history" | "stream_viewers" | "session_retention" | "all"
 *   (default: "all")
 *
 * Response 200:
 * {
 *   tables: [
 *     {
 *       table_name: string,
 *       status: "pending" | "in_progress" | "completed" | "failed",
 *       last_backfill_at: string | null (ISO),
 *       rows_backfilled: number,
 *       rows_skipped: number,
 *       estimated_remaining: number,
 *       error_message: string | null,
 *       progress_percentage: number
 *     }
 *   ],
 *   all_tables_complete: boolean
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  table: z.enum(["watch_history", "stream_viewers", "session_retention", "all"]).default("all"),
});

export interface BackfillTableStatus {
  table_name: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  last_backfill_at: string | null;
  rows_backfilled: number;
  rows_skipped: number;
  estimated_remaining: number;
  error_message: string | null;
  progress_percentage: number;
}

export interface BackfillStatusResponse {
  tables: BackfillTableStatus[];
  all_tables_complete: boolean;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const queryResult = await validateQuery(req, querySchema);
  if (queryResult instanceof NextResponse) {
    return queryResult;
  }

  const { table: tableFilter } = queryResult.data;

  try {
    const tables = [
      "watch_history",
      "stream_viewers",
      "session_retention",
    ];

    const filteredTables =
      tableFilter === "all" ? tables : [tableFilter];

    // Fetch status from route_f_backfill_status
    const { rows: statusRows } = await sql<{
      table_name: string;
      status: string;
      last_backfill_at: string | null;
      rows_backfilled: number;
      rows_skipped: number;
      estimated_remaining_rows: number | null;
      error_message: string | null;
    }>`
      SELECT
        table_name,
        status,
        last_backfill_at,
        rows_backfilled,
        rows_skipped,
        estimated_remaining_rows,
        error_message
      FROM route_f_backfill_status
      WHERE table_name = ANY(${filteredTables}::text[])
      ORDER BY table_name
    `;

    // For tables with no status yet, initialize them
    const existingTables = new Set(statusRows.map((r) => r.table_name));
    const missingTables = filteredTables.filter((t) => !existingTables.has(t));

    if (missingTables.length > 0) {
      for (const t of missingTables) {
        await sql`
          INSERT INTO route_f_backfill_status (table_name, status, rows_backfilled, rows_skipped)
          VALUES (${t}, 'pending', 0, 0)
          ON CONFLICT (table_name) DO NOTHING
        `;
      }

      // Refetch
      const { rows: refreshedRows } = await sql<
        typeof statusRows[0]
      >`
        SELECT
          table_name,
          status,
          last_backfill_at,
          rows_backfilled,
          rows_skipped,
          estimated_remaining_rows,
          error_message
        FROM route_f_backfill_status
        WHERE table_name = ANY(${filteredTables}::text[])
        ORDER BY table_name
      `;

      statusRows.splice(0, statusRows.length, ...refreshedRows);
    }

    // Compute progress percentage for each table
    const tableStatuses: BackfillTableStatus[] = statusRows.map((row) => {
      const total = (row.rows_backfilled || 0) + (row.rows_skipped || 0) + (row.estimated_remaining_rows || 0);
      const progressPercentage = total > 0 ? Math.round(((row.rows_backfilled || 0) / total) * 100) : 0;

      return {
        table_name: row.table_name,
        status: row.status as any,
        last_backfill_at: row.last_backfill_at,
        rows_backfilled: row.rows_backfilled || 0,
        rows_skipped: row.rows_skipped || 0,
        estimated_remaining: row.estimated_remaining_rows || 0,
        error_message: row.error_message,
        progress_percentage: progressPercentage,
      };
    });

    const allComplete = tableStatuses.every((t) => t.status === "completed");

    const response: BackfillStatusResponse = {
      tables: tableStatuses,
      all_tables_complete: allComplete,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("[backfill-status] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
