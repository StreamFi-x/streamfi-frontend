import { NextResponse } from "next/server";
import type { CancelDeletionResult } from "@/lib/users/deletion";

/** HTTP mapping shared by the self-service and admin cancel endpoints. */
export function cancelResponse(
  outcome: CancelDeletionResult["outcome"]
): NextResponse {
  switch (outcome) {
    case "cancelled":
    case "already_cancelled":
      return NextResponse.json({ ok: true, outcome });
    case "purge_in_progress":
      return NextResponse.json(
        {
          error: "The purge has already started and can no longer be cancelled",
          outcome,
        },
        { status: 409 }
      );
    case "already_purged":
      return NextResponse.json(
        { error: "The account has already been purged", outcome },
        { status: 410 }
      );
    default:
      return NextResponse.json(
        { error: "No pending deletion", outcome },
        { status: 404 }
      );
  }
}
