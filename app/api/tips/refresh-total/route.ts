// app/api/tips/refresh-total/route.ts
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import {
  createTipReceivedNotification,
  withNotificationTransaction,
} from "@/lib/notifications";
import { fetchPaymentsReceived } from "@/lib/stellar/horizon";

export async function POST(request: NextRequest) {
  const session = await verifySession(request);
  if (!session.ok) {
    return session.response;
  }

  try {
    const { username } = await request.json();

    if (!username) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 }
      );
    }

    // 1. Fetch user from database
    const userResult = await sql`
      SELECT id, username, wallet AS stellar_public_key, last_tip_at
      FROM users
      WHERE LOWER(username) = LOWER(${username})
    `;

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userResult.rows[0];
    if (user.id !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!user.stellar_public_key) {
      return NextResponse.json(
        { error: "User has not configured Stellar wallet" },
        { status: 400 }
      );
    }

    // 2. Fetch all tips from Horizon API
    let allTips: any[] = [];
    let cursor: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const {
        tips,
        nextCursor,
      }: { tips: any[]; nextCursor: string | undefined } =
        await fetchPaymentsReceived({
          publicKey: user.stellar_public_key,
          limit: 200,
          cursor,
        });

      allTips = [...allTips, ...tips];
      cursor = nextCursor || undefined;
      hasMore = !!nextCursor;
    }

    // 3. Calculate totals
    const totalReceived = allTips
      .reduce((sum, tip) => {
        return sum + parseFloat(tip.amount);
      }, 0)
      .toFixed(7);

    const totalCount = allTips.length;
    const lastTipAt = allTips.length > 0 ? allTips[0].timestamp : null;
    const shouldCreateTipNotifications = Boolean(user.last_tip_at);
    const newTips = shouldCreateTipNotifications
      ? allTips.filter(
          tip =>
            Date.parse(tip.timestamp) >= Date.parse(String(user.last_tip_at))
        )
      : [];

    // 4. Update database
    await withNotificationTransaction(async client => {
      await client.sql`
        UPDATE users
        SET 
          total_tips_received = ${totalReceived},
          total_tips_count = ${totalCount},
          last_tip_at = ${lastTipAt},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${user.id}
      `;

      for (const tip of [...newTips].reverse()) {
        await createTipReceivedNotification({
          userId: user.id,
          amount: tip.amount,
          senderLabel: tip.sender,
          senderWallet: tip.sender,
          txHash: tip.txHash,
          paymentId: tip.id,
          client,
        });
      }
    });

    // 5. Return updated statistics
    return NextResponse.json({
      username: user.username,
      totalReceived,
      totalCount,
      lastTipAt,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Refresh total error:", error);
    return NextResponse.json(
      { error: "Failed to refresh tip totals" },
      { status: 500 }
    );
  }
}
