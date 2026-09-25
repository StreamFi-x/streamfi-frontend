/**
 * POST /api/routes-f/account-delete-cancel
 * Body: { user_id: string }
 *
 * Cancels a pending account deletion while it is still within its grace
 * period, restoring the account to normal standing.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  cancelAccountDeletion,
  DeletionRequestNotFoundError,
  DeletionNotPendingError,
} from "./store";
import type { AccountDeleteCancelBody, AccountDeleteCancelResponse } from "./types";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: AccountDeleteCancelBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { user_id } = body ?? ({} as AccountDeleteCancelBody);

  if (!user_id || typeof user_id !== "string") {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  try {
    const deletion_request = cancelAccountDeletion(user_id);
    return NextResponse.json({ deletion_request } satisfies AccountDeleteCancelResponse);
  } catch (error) {
    if (error instanceof DeletionRequestNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof DeletionNotPendingError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
