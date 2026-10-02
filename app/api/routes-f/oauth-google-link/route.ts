/**
 * POST /api/routes-f/oauth-google-link
 *
 * Links a Google identity to the caller's authenticated account.
 *
 * Body: { credential: string }  — a Google Identity Services ID token (JWT)
 *
 * Refuses (409) if the Google identity is already linked to a DIFFERENT
 * account. Re-linking the same Google identity to the same account is
 * idempotent.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { verifyGoogleCredential } from "./_lib/verify-google-credential";
import { linkGoogleAccount } from "./_lib/store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { credential } = (body ?? {}) as Record<string, unknown>;

  const verification = verifyGoogleCredential(credential);
  if (!verification.ok) {
    return NextResponse.json({ error: verification.error }, { status: 400 });
  }

  const { sub: googleId, email } = verification.claims;

  const result = linkGoogleAccount(session.userId, googleId, email);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      linked: true,
      google_id: result.record.google_id,
      email: result.record.email,
      linked_at: result.record.linked_at,
    },
    { status: 200 }
  );
}
