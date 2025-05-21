/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { rateLimit } from "../../../../utils/rate-limit";
import {
  checkExistingTableDetail,
  validateEmail,
} from "../../../../utils/validators";
import { sql } from "@vercel/postgres";
import { sendWelcomeRegistrationEmail } from "@/utils/send-email";

// Rate limiter: 5 requests per minute so as not to abuse it
const limiter = rateLimit({
  interval: 60 * 1000,
  //   uniqueTokenPerInterval: 500,
  //   max: 5,
});

async function handler(req: Request, res: any) {
  //   console.log("Environment variables:", {
  //   POSTGRES_URL: process.env.POSTGRES_URL ? "Set" : "Not set",
  //   DATABASE_URL: process.env.DATABASE_URL ? "Set" : "Not set"
  // });

  try {
    const tableCheck = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `;
    console.log(
      "Available tables:",
      tableCheck.rows.map((row) => row.table_name)
    );
  } catch (err) {
    console.error("Table check error:", err);
  }

  try {
    const result = await sql`SELECT current_database(), current_schema()`;
    console.log("Connected to:", result.rows[0]);
  } catch (err) {
    console.error("Connection diagnostic error:", err);
  }

  await sql`
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255),
    streamkey VARCHAR(255),
    avatar VARCHAR(255),
    bio TEXT,
    socialLinks JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )
`;

  if (req.method !== "POST") {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
    // return res.status(405).json({ error: "Method not allowed" });
  }

  // try {
  //   await limiter.check(res, 5, "UNSUBSCRIBE_RATE_LIMIT");
  // } catch {
  //   return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  //   // return res.status(429).json({ error: "Rate limit exceeded" });
  // }

  const requestBody = await req.json();
  const { email, username, wallet } = requestBody;

  if (!username) {
    return NextResponse.json(
      { error: "Username is required" },
      { status: 400 }
    );
    // return res.status(400).json({ error: "Email is required" });
  }
  if (!wallet) {
    return NextResponse.json({ error: "Wallet is required" }, { status: 400 });
    // return res.status(400).json({ error: "Email is required" });
  }

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
    // return res.status(400).json({ error: "Email is required" });
  }

  if (!validateEmail(email)) {
    return NextResponse.json(
      { error: "Invalid email format" },
      { status: 400 }
    );
    // return res.status(400).json({ error: "Invalid email format" });
  }

  try {
    const userEmailExist = await checkExistingTableDetail(
      "users",
      "email",
      email
    );

    const usernameExist = await checkExistingTableDetail(
      "users",
      "username",
      username
    );

    const userWalletExist = await checkExistingTableDetail(
      "users",
      "wallet",
      wallet
    );

    if (userEmailExist) {
      return NextResponse.json(
        { error: "Email already exist" },
        { status: 400 }
      );
      // return res
      // .status(404)
      // .json({ error: "Email not found or already unsubscribed" });
    }
    if (usernameExist) {
      return NextResponse.json(
        { error: "Username already exist" },
        { status: 400 }
      );
    }
    if (userWalletExist) {
      return NextResponse.json(
        { error: "Wallet address already exist" },
        { status: 400 }
      );
    }

    await sql`
      INSERT INTO users (email, username, wallet)
      VALUES (${email}, ${username}, ${wallet})
    `;

    await sendWelcomeRegistrationEmail(email, username);

    return NextResponse.json(
      { message: "User registration success" },
      { status: 200 }
    );
    // return res.status(200).json({ message: "User registration success" });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Failed to register user" },
      { status: 500 }
    );
    // return res.status(500).json({ error: "Failed to register user" });
  }
}

export { handler as POST, handler as GET };
