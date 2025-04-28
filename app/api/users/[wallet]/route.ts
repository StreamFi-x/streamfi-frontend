/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { rateLimit } from "../../../../utils/rate-limit";
import { sql } from "@vercel/postgres";

// Rate limiter: 5 requests per minute so as not to abuse it
const limiter = rateLimit({
  interval: 60 * 1000,
  //   uniqueTokenPerInterval: 500,
  //   max: 5,
});
async function handler(
  req: Request,
  { params }: { params: { wallet: string } },
  res: any
) {
  if (req.method !== "GET") {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
    // return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await limiter.check(res, 5, "UNSUBSCRIBE_RATE_LIMIT");
  } catch {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    // return res.status(429).json({ error: "Rate limit exceeded" });
  }

  try {
    const result = await sql`
    SELECT * FROM users WHERE wallet = ${params.wallet}
  `;

    const user = result.rows[0]; // grab first user (assuming unique wallet)

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Fetch user error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
    // return res.status(500).json({ error: "Failed to fetch user" });
  }
}

export { handler as POST, handler as GET };
