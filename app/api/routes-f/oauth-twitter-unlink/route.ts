/**
 * POST /api/routes-f/oauth-twitter-unlink
 * Removes the Twitter OAuth link from a user's account. Refuses when
 * Twitter is the account's only login method, since unlinking it would
 * leave the account with no way to sign in.
 */
import { NextRequest, NextResponse } from "next/server";
import type {
  OauthTwitterUnlinkBody,
  OauthTwitterUnlinkResponse,
} from "./types";
import {
  unlinkTwitter,
  UserNotFoundError,
  TwitterNotLinkedError,
  OnlyLoginMethodError,
} from "./store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: OauthTwitterUnlinkBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { user_id } = body;

  if (!user_id || typeof user_id !== "string") {
    return NextResponse.json(
      { error: "user_id is required" },
      { status: 400 }
    );
  }

  try {
    const updated = unlinkTwitter(user_id);

    return NextResponse.json({
      user_id: updated.user_id,
      methods: updated.methods,
    } as OauthTwitterUnlinkResponse);
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof TwitterNotLinkedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof OnlyLoginMethodError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    throw error;
  }
}
