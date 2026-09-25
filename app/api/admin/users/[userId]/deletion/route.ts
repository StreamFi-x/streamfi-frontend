import { NextRequest, NextResponse } from "next/server";
import { adminUnauthorized, getAdminIdentity } from "@/lib/admin-auth";
import {
  cancelAccountDeletion,
  resetPurgeAttempts,
  setLegalHold,
} from "@/lib/users/deletion";
import { cancelResponse } from "@/lib/users/deletion-http";

/**
 * DELETE → cancel the user's pending deletion (restores the account).
 * PATCH  { legalHold: boolean, reason?: string } → place/lift a legal hold
 *        { action: "retry" } → re-arm a purge that exhausted its attempts
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
): Promise<Response> {
  const admin = await getAdminIdentity();
  if (!admin) {
    return adminUnauthorized();
  }
  const { userId } = await params;
  try {
    const result = await cancelAccountDeletion({
      userId,
      cancelledBy: `admin:${admin}`,
    });
    return cancelResponse(result.outcome);
  } catch (err) {
    console.error("[admin/users/deletion] cancel error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
): Promise<Response> {
  const admin = await getAdminIdentity();
  if (!admin) {
    return adminUnauthorized();
  }
  const { userId } = await params;

  let body: { legalHold?: unknown; reason?: unknown; action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    if (body.action === "retry") {
      const ok = await resetPurgeAttempts(userId);
      return ok
        ? NextResponse.json({ ok: true })
        : NextResponse.json(
            { error: "No failed purge for this user" },
            { status: 404 }
          );
    }

    if (typeof body.legalHold !== "boolean") {
      return NextResponse.json(
        { error: "Provide legalHold (boolean) or action: 'retry'" },
        { status: 400 }
      );
    }
    const ok = await setLegalHold({
      userId,
      hold: body.legalHold,
      reason:
        typeof body.reason === "string" ? body.reason.slice(0, 500) : null,
    });
    return ok
      ? NextResponse.json({ ok: true, legalHold: body.legalHold })
      : NextResponse.json(
          { error: "No open deletion for this user" },
          { status: 404 }
        );
  } catch (err) {
    console.error("[admin/users/deletion] PATCH error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
