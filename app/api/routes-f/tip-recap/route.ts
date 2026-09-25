import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getQuerySchema = z.object({
  tip_id: z.string().uuid(),
});

type TipRecapPayload = {
  tip_id: string;
  creator: {
    user_id: string;
    username: string | null;
    avatar: string | null;
  };
  tipper: {
    user_id: string | null;
    username: string | null;
    avatar: string | null;
    anonymous: boolean;
  };
  amount: string;
  asset: string;
  message: string | null;
  image_meta: {
    width: number;
    height: number;
    format: string;
  };
  created_at: string;
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const queryResult = validateQuery(
    new URL(req.url).searchParams,
    getQuerySchema
  );
  if (queryResult instanceof NextResponse) {
    return queryResult;
  }

  const { tip_id } = queryResult.data;

  try {
    const { rows: tipRows } = await sql`
      SELECT
        t.id AS tip_id,
        t.creator_id,
        t.tipper_id,
        t.amount,
        t.asset,
        t.message,
        t.is_anonymous,
        t.created_at,
        u_creator.username  AS creator_username,
        u_creator.avatar    AS creator_avatar,
        u_tipper.username   AS tipper_username,
        u_tipper.avatar     AS tipper_avatar
      FROM tip_transactions t
      LEFT JOIN users u_creator ON u_creator.id = t.creator_id
      LEFT JOIN users u_tipper  ON u_tipper.id = t.tipper_id
      WHERE t.id = ${tip_id}
      LIMIT 1
    `;

    if (tipRows.length === 0) {
      return NextResponse.json(
        { error: "Tip not found" },
        { status: 404 }
      );
    }

    const tip = tipRows[0];
    const isAnonymous = tip.is_anonymous === true;

    const payload: TipRecapPayload = {
      tip_id: tip.tip_id,
      creator: {
        user_id: tip.creator_id,
        username: tip.creator_username,
        avatar: tip.creator_avatar,
      },
      tipper: isAnonymous
        ? {
            user_id: null,
            username: null,
            avatar: null,
            anonymous: true,
          }
        : {
            user_id: tip.tipper_id,
            username: tip.tipper_username,
            avatar: tip.tipper_avatar,
            anonymous: false,
          },
      amount: String(tip.amount),
      asset: tip.asset ?? "XLM",
      message: tip.message ?? null,
      image_meta: {
        width: 1200,
        height: 630,
        format: "png",
      },
      created_at: tip.created_at,
    };

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  } catch (error) {
    console.error("[routes-f tip-recap GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch tip recap" },
      { status: 500 }
    );
  }
}
