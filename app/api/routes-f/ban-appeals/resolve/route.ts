import { NextRequest, NextResponse } from "next/server";
import { resolveAppeal } from "../store";
import type { AppealDecision } from "../types";

const VALID_DECISIONS: AppealDecision[] = ["accept", "reject"];

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: {
    appeal_id?: unknown;
    decision?: unknown;
    mod_note?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const appeal_id = typeof body.appeal_id === "string" ? body.appeal_id.trim() : "";
  const decision = body.decision as AppealDecision;
  const mod_note =
    typeof body.mod_note === "string" ? body.mod_note : undefined;

  if (!appeal_id) {
    return NextResponse.json({ error: "appeal_id is required." }, { status: 400 });
  }

  if (!VALID_DECISIONS.includes(decision)) {
    return NextResponse.json(
      { error: "decision must be accept or reject." },
      { status: 400 }
    );
  }

  const result = resolveAppeal({ appeal_id, decision, mod_note });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { appeal } = result;
  return NextResponse.json({
    appeal_id: appeal.appeal_id,
    status: appeal.status,
    mod_note: appeal.mod_note,
    resolved_at: appeal.resolved_at,
  });
}
