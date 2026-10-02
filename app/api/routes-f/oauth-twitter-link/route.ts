/**
 * POST /api/routes-f/oauth-twitter-link
 *
 * Links a Twitter identity to the caller's authenticated account.
 *
 * Body: { oauth_code: string } — a Twitter OAuth 2.0 authorization code
 *
 * Refuses (409) if the Twitter identity is already linked to a DIFFERENT
 * account. Re-linking the same Twitter identity to the same account is
 * idempotent.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { verifyTwitterCredential } from "./_lib/verify-twitter-credential";
import { linkTwitterAccount, TwitterAlreadyLinkedError } from "./_lib/store";

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

  const { oauth_code } = (body ?? {}) as Record<string, unknown>;

  const verification = verifyTwitterCredential(oauth_code);
  if (!verification.ok) {
    return NextResponse.json({ error: verification.error }, { status: 400 });
  }

  const { id: twitterId, username } = verification.claims;

  try {
    const record = linkTwitterAccount(session.userId, twitterId, username);
    return NextResponse.json(
      {
        linked: true,
        twitter_id: record.twitter_id,
        username: record.username,
        linked_at: record.linked_at,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof TwitterAlreadyLinkedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
