// app/api/tips/refresh-total/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { fetchPaymentsReceived } from '@/lib/stellar/horizon';



export async function POST(request: Request) {
    try {
        const { username } = await request.json();

        if (!username) {
            return NextResponse.json(
                { error: 'Username is required' },
                { status: 400 }
            );
        }

        // TODO: Add authentication check here
        // Verify that the requesting user is the owner or admin

        // 1. Fetch user from database
        const userResult = await sql`
      SELECT id, username, stellar_public_key
      FROM users
      WHERE username = ${username}
    `;

        if (userResult.rows.length === 0) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        const user = userResult.rows[0];
        if (!user.stellar_public_key) {
            return NextResponse.json(
                { error: 'User has not configured Stellar wallet' },
                { status: 400 }
            );
        }

        // 2. Fetch all tips from Horizon API
        let allTips: any[] = [];
        let cursor: string | undefined = undefined;
        let hasMore = true;

        while (hasMore) {
            const { tips, nextCursor }: { tips: any[]; nextCursor: string | undefined } = await fetchPaymentsReceived({
                publicKey: user.stellar_public_key,
                limit: 200,
                cursor
            });

            allTips = [...allTips, ...tips];
            cursor = nextCursor || undefined;
            hasMore = !!nextCursor;
        }

        // 3. Calculate totals
        const totalReceived = allTips.reduce((sum, tip) => {
            return sum + parseFloat(tip.amount);
        }, 0).toFixed(7);

        const totalCount = allTips.length;
        const lastTipAt = allTips.length > 0 ? allTips[0].timestamp : null;

        // 4. Update database
        await sql`
      UPDATE users
      SET 
        total_tips_received = ${totalReceived},
        total_tips_count = ${totalCount},
        last_tip_at = ${lastTipAt},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${user.id}
    `;

        // 5. Return updated statistics
        return NextResponse.json({
            username: user.username,
            totalReceived,
            totalCount,
            lastTipAt,
            refreshedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Refresh total error:', error);
        return NextResponse.json(
            { error: 'Failed to refresh tip totals' },
            { status: 500 }
        );
    }
}