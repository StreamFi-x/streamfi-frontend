import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { validateBody } from "../_lib/validate";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const toggleAnonymousSchema = z.object({
  tip_id: z.string(),
  anonymous: z.boolean(),
});

/**
 * POST /api/routes-f/tips
 * Toggle anonymous flag on a tip
 */
export async function POST(req: NextRequest) {
  const bodyResult = await validateBody(req, toggleAnonymousSchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const { tip_id, anonymous } = bodyResult.data;

  try {
    const { rows } = await sql`
      UPDATE tips
      SET anonymous = ${anonymous}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${tip_id}
      RETURNING id, anonymous, updated_at
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Tip not found" }, { status: 404 });
    }

    return NextResponse.json({ updated: true, tip: rows[0] });
  } catch (error) {
    console.error("[Tips API] Error updating tip:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
