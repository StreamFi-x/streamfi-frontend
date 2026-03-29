import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { ensureGiftSchema } from "../_lib/db";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    await ensureGiftSchema();

    const { rows } = await sql`
      SELECT
        gt.id,
        gt.gift_id,
        gt.gift_name,
        gt.quantity,
        gt.amount_usdc::text AS amount_usdc,
        gt.tx_hash,
        gt.stream_session_id AS stream_id,
        gt.created_at,
        gt.supporter_id,
        gt.creator_id,
        sender.username AS sender_username,
        sender.avatar AS sender_avatar,
        recipient.username AS recipient_username,
        recipient.avatar AS recipient_avatar,
        CASE
          WHEN gt.supporter_id = ${session.userId} THEN 'sent'
          ELSE 'received'
        END AS direction
      FROM gift_transactions gt
      LEFT JOIN users sender ON sender.id = gt.supporter_id
      LEFT JOIN users recipient ON recipient.id = gt.creator_id
      WHERE gt.supporter_id = ${session.userId}
         OR gt.creator_id = ${session.userId}
      ORDER BY gt.created_at DESC
      LIMIT 100
    `;

    return NextResponse.json({
      history: rows,
    });
  } catch (error) {
    console.error("[routes-f gifts/history GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch gift history" },
      { status: 500 }
    );
  }
}
