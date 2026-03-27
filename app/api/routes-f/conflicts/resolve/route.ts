/**
 * POST /api/routes-f/conflicts/resolve
 *
 * Admin-only: resolve a username dispute.
 * Requires the caller to be an admin (checked via users.is_admin flag).
 *
 * Request body:
 *   {
 *     "claimed_username": "alice",
 *     "claimant_user_id": "uuid",
 *     "reason": "Original creator migrating from Twitch with 50k followers",
 *     "action": "transfer" | "deny"
 *   }
 *
 * On "transfer":
 *   - Rename the current username holder to "{username}_" (atomically, in a DB transaction)
 *   - Assign the username to the claimant
 *   - Mark dispute as resolved
 *
 * On "deny":
 *   - Mark dispute as denied; no username changes occur
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { usernameSchema, uuidSchema } from "@/app/api/routes-f/_lib/schemas";
import { ensureDisputesTable } from "../_lib/disputes";

const resolveBodySchema = z.object({
  claimed_username: usernameSchema,
  claimant_user_id: uuidSchema,
  reason: z.string().min(1, "reason is required").max(1000),
  action: z.enum(["transfer", "deny"]),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Auth + admin check
  const session = await verifySession(req);
  if (!session.ok) {return session.response;}

  try {
    const adminCheck = await sql`
      SELECT 1 FROM users WHERE id = ${session.userId} AND is_admin = TRUE LIMIT 1
    `;
    if (adminCheck.rows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch (err) {
    console.error("[conflicts/resolve] DB error checking admin:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }

  // 2. Validate body
  const bodyResult = await validateBody(req, resolveBodySchema);
  if (bodyResult instanceof Response) {return bodyResult;}

  const { claimed_username, claimant_user_id, reason, action } = bodyResult.data;

  try {
    await ensureDisputesTable();

    // 3. Verify claimant exists
    const { rows: claimantRows } = await sql`
      SELECT id, username FROM users WHERE id = ${claimant_user_id} LIMIT 1
    `;
    if (claimantRows.length === 0) {
      return NextResponse.json(
        { error: "Claimant user not found" },
        { status: 404 }
      );
    }

    if (action === "deny") {
      // Record the denied dispute and return
      await sql`
        INSERT INTO username_disputes
          (claimed_username, claimant_user_id, reason, status, resolved_by, resolved_action, resolved_at)
        VALUES
          (${claimed_username}, ${claimant_user_id}, ${reason}, 'denied', ${session.userId}, 'deny', now())
      `;

      return NextResponse.json({ action: "deny", username: claimed_username });
    }

    // 4. Transfer: find the current holder
    const { rows: holderRows } = await sql`
      SELECT id, username FROM users
      WHERE LOWER(username) = LOWER(${claimed_username})
      LIMIT 1
    `;

    if (holderRows.length === 0) {
      // Username is already free — just assign it to the claimant
      await sql`
        UPDATE users SET username = ${claimed_username} WHERE id = ${claimant_user_id}
      `;
      await sql`
        INSERT INTO username_disputes
          (claimed_username, claimant_user_id, reason, status, resolved_by, resolved_action, resolved_at)
        VALUES
          (${claimed_username}, ${claimant_user_id}, ${reason}, 'resolved', ${session.userId}, 'transfer', now())
      `;
      return NextResponse.json({ action: "transfer", username: claimed_username });
    }

    const holderId: string = holderRows[0].id;
    const holderUsername: string = holderRows[0].username;
    const renamedUsername = `${holderUsername}_`;

    // 5. Atomic transfer using a transaction
    // @vercel/postgres does not expose BEGIN/COMMIT directly, so we use
    // a transaction via sql template tag chaining.
    await sql`BEGIN`;
    try {
      // Rename the current holder
      await sql`
        UPDATE users SET username = ${renamedUsername} WHERE id = ${holderId}
      `;
      // Assign to claimant
      await sql`
        UPDATE users SET username = ${claimed_username} WHERE id = ${claimant_user_id}
      `;
      // Record dispute resolution
      await sql`
        INSERT INTO username_disputes
          (claimed_username, claimant_user_id, reason, status, resolved_by, resolved_action, resolved_at)
        VALUES
          (${claimed_username}, ${claimant_user_id}, ${reason}, 'resolved', ${session.userId}, 'transfer', now())
      `;
      await sql`COMMIT`;
    } catch (txErr) {
      await sql`ROLLBACK`;
      throw txErr;
    }

    return NextResponse.json({
      action: "transfer",
      username: claimed_username,
      previous_holder_renamed_to: renamedUsername,
    });
  } catch (err) {
    console.error("[conflicts/resolve] DB error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
