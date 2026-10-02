/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const userId =
      body.userId ?? body.user_id ?? body.username ?? body.wallet ?? body.id;

    if (!userId) {
      return NextResponse.json(
        {
          error:
            "User identifier required (userId, user_id, username, or wallet)",
        },
        { status: 400 }
      );
    }

    const verified =
      typeof body.verified === "boolean"
        ? body.verified
        : typeof body.is_verified === "boolean"
          ? body.is_verified
          : true;

    return NextResponse.json({
      success: true,
      user_id: userId,
      is_verified: verified,
      verified: verified,
      message: `User ${userId} verification status updated to ${verified}`,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request payload" },
      { status: 400 }
    );
  }
}
