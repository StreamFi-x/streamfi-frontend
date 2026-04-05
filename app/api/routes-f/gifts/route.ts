import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { uuidSchema } from "@/app/api/routes-f/_lib/schemas";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { ensureGiftSchema, getGiftCatalogItem } from "./_lib/db";

const sendGiftSchema = z.object({
  recipient_id: uuidSchema,
  gift_id: z.enum(["flower", "candy", "crown", "lion", "dragon"]),
  quantity: z.number().int().min(1).max(100),
  stream_id: uuidSchema.optional(),
  tx_hash: z.string().trim().min(1).max(255).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, sendGiftSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  try {
    await ensureGiftSchema();

    const { recipient_id, gift_id, quantity, stream_id, tx_hash } =
      bodyResult.data;
    const gift = getGiftCatalogItem(gift_id);

    if (!gift) {
      return NextResponse.json({ error: "Gift not found" }, { status: 404 });
    }

    const { rows: recipientRows } = await sql`
      SELECT id, username
      FROM users
      WHERE id = ${recipient_id}
      LIMIT 1
    `;

    if (recipientRows.length === 0) {
      return NextResponse.json(
        { error: "Recipient not found" },
        { status: 404 }
      );
    }

    const amountUsd = gift.price_usd * quantity;

    const { rows } = await sql`
      INSERT INTO gift_transactions (
        supporter_id,
        creator_id,
        recipient_id,
        stream_session_id,
        gift_id,
        gift_name,
        quantity,
        amount_usdc,
        tx_hash
      )
      VALUES (
        ${session.userId},
        ${recipient_id},
        ${recipient_id},
        ${stream_id ?? null},
        ${gift.id},
        ${gift.name},
        ${quantity},
        ${amountUsd},
        ${tx_hash ?? null}
      )
      RETURNING
        id,
        supporter_id,
        creator_id,
        recipient_id,
        stream_session_id AS stream_id,
        gift_id,
        gift_name,
        quantity,
        amount_usdc::text AS amount_usdc,
        tx_hash,
        created_at
    `;

    // Activity events — non-blocking
    try {
      const recipientUsername = recipientRows[0].username;
      const { rows: senderRows } = await sql`
        SELECT username FROM users WHERE id = ${session.userId} LIMIT 1
      `;
      const senderUsername = senderRows[0]?.username ?? "Someone";

      await Promise.all([
        sql`
          INSERT INTO route_f_activity_events (user_id, type, actor_id, metadata)
          VALUES (
            ${recipient_id},
            'gift_received',
            ${session.userId},
            ${JSON.stringify({
              gift_name: gift.name,
              quantity,
              amount_usdc: amountUsd,
              sender_username: senderUsername,
            })}::jsonb
          )
        `,
        sql`
          INSERT INTO route_f_activity_events (user_id, type, metadata)
          VALUES (
            ${session.userId},
            'gift_sent',
            ${JSON.stringify({
              gift_name: gift.name,
              quantity,
              amount_usdc: amountUsd,
              recipient_username: recipientUsername,
            })}::jsonb
          )
        `,
      ]);
    } catch (activityErr) {
      console.error("[routes-f gifts] activity insert error:", activityErr);
    }

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("[routes-f gifts POST]", error);
    return NextResponse.json({ error: "Failed to send gift" }, { status: 500 });
  }
}
