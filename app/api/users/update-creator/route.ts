import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { invalidateUserCaches } from "@/lib/cache/invalidation";

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { email, creator } = body;

    if (!email || !creator) {
      return NextResponse.json(
        { error: "Email and creator data are required" },
        { status: 400 }
      );
    }

    const {
      streamTitle = "",
      tags = [],
      category = "",
      payout = "",
      thumbnail = "",
    } = creator;

    const updatedCreator = {
      streamTitle,
      tags,
      category,
      payout,
      thumbnail,
    };

    const result = await sql`
      UPDATE users
      SET creator = ${JSON.stringify(updatedCreator)},
          updated_at = CURRENT_TIMESTAMP
      WHERE email = ${email}
      RETURNING username, wallet
    `;

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    await invalidateUserCaches(result.rows[0]);

    return NextResponse.json(
      { message: "Creator info updated successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating creator info:", error);
    return NextResponse.json(
      { error: "Failed to update creator info" },
      { status: 500 }
    );
  }
}
