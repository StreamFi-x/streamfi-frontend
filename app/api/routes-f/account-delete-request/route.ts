/**
 * POST /api/routes-f/account-delete-request
 * Begins the account deletion flow. The account is scheduled for deletion
 * 14 days from the request so the user has a grace period to cancel before
 * it becomes irreversible. A second request while one is already pending is
 * rejected.
 */
import { NextRequest, NextResponse } from "next/server";
import type {
  AccountDeleteRequestBody,
  AccountDeleteRequestResponse,
} from "./types";
import {
  requestAccountDeletion,
  DeletionAlreadyPendingError,
  GRACE_PERIOD_DAYS,
} from "./store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: AccountDeleteRequestBody;
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
    const deletion_request = requestAccountDeletion(user_id);

    return NextResponse.json({
      deletion_request,
      grace_period_days: GRACE_PERIOD_DAYS,
    } as AccountDeleteRequestResponse);
  } catch (error) {
    if (error instanceof DeletionAlreadyPendingError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
