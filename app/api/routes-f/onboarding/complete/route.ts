import { NextRequest, NextResponse } from "next/server";
import { ONBOARDING_STORE, USER_PROFILES } from "../route";

const VALID_STEP_IDS = [
  "set_avatar",
  "set_bio",
  "set_stream_title",
  "add_category",
  "first_stream",
  "connect_wallet",
  "first_follower",
  "first_tip",
];

// ---------------------------------------------------------------------------
// POST /api/routes-f/onboarding/complete
// Manually mark a step complete (edge cases like wallet connection)
// Body: { step_id: string } | { dismiss: true }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  if (!USER_PROFILES.has(userId)) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  let body: { step_id?: string; dismiss?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Ensure progress record exists
  if (!ONBOARDING_STORE.has(userId)) {
    ONBOARDING_STORE.set(userId, {
      user_id: userId,
      completed: [],
      dismissed: false,
      completed_at: null,
      updated_at: new Date().toISOString(),
    });
  }

  const progress = ONBOARDING_STORE.get(userId)!;

  // Handle dismiss flag
  if (body.dismiss === true) {
    progress.dismissed = true;
    progress.updated_at = new Date().toISOString();
    return NextResponse.json({ success: true, dismissed: true });
  }

  // Handle step completion
  const { step_id } = body;
  if (!step_id) {
    return NextResponse.json(
      { error: "step_id or dismiss:true is required." },
      { status: 400 }
    );
  }

  if (!VALID_STEP_IDS.includes(step_id)) {
    return NextResponse.json(
      { error: `Unknown step_id: '${step_id}'.` },
      { status: 400 }
    );
  }

  if (!progress.completed.includes(step_id)) {
    progress.completed.push(step_id);
    progress.updated_at = new Date().toISOString();
  }

  return NextResponse.json({ success: true, step_id, already_completed: progress.completed.includes(step_id) });
}
