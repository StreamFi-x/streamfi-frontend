import { NextResponse } from "next/server";
import { checkExistingTableDetail, validateEmail } from "@/utils/validators";
import { sql } from "@vercel/postgres";
import { sendWelcomeRegistrationEmail } from "@/utils/send-email";

async function handler(req: Request) {
  try {
    const tableCheck = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    console.log(
      "Available tables:",
      tableCheck.rows.map((row) => row.table_name),
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

  // Ensure the users table exists with all required fields
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wallet VARCHAR(255) UNIQUE NOT NULL,
      username VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      streamkey VARCHAR(255),
      avatar VARCHAR(255),
      bio TEXT,
      socialLinks JSONB DEFAULT '[]',
      emailVerified BOOLEAN DEFAULT FALSE,
      emailNotifications BOOLEAN DEFAULT TRUE,
      creator JSONB DEFAULT '{"streamTitle":"", "tags":[], "category":"", "payout":"", "thumbnail":""}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `;

  if (req.method !== "POST") {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  const requestBody = await req.json();
  const {
    email,
    username,
    wallet,
    socialLinks = [],
    emailNotifications = true,
    creator = {
      streamTitle: "",
      tags: [],
      category: "",
      payout: "",
      thumbnail: "",
    },
  } = requestBody;

  // Basic validation
  if (!username) {
    return NextResponse.json(
      { error: "Username is required" },
      { status: 400 },
    );
  }

  if (!wallet) {
    return NextResponse.json({ error: "Wallet is required" }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!validateEmail(email)) {
    return NextResponse.json(
      { error: "Invalid email format" },
      { status: 400 },
    );
  }

  try {
    // Check for existing records
    const userEmailExist = await checkExistingTableDetail(
      "users",
      "email",
      email,
    );

    const usernameExist = await checkExistingTableDetail(
      "users",
      "username",
      username,
    );

    const userWalletExist = await checkExistingTableDetail(
      "users",
      "wallet",
      wallet,
    );

    if (userEmailExist) {
      return NextResponse.json(
        { error: "Email already exist" },
        { status: 400 },
      );
    }

    if (usernameExist) {
      return NextResponse.json(
        { error: "Username already exist" },
        { status: 400 },
      );
    }

    if (userWalletExist) {
      return NextResponse.json(
        { error: "Wallet address already exist" },
        { status: 400 },
      );
    }

    // Insert the new user with all fields
    await sql`
      INSERT INTO users (
        email, 
        username, 
        wallet, 
        socialLinks, 
        emailNotifications,
        creator
      )
      VALUES (
        ${email}, 
        ${username}, 
        ${wallet}, 
        ${JSON.stringify(socialLinks)}, 
        ${emailNotifications},
        ${JSON.stringify(creator)}
      )
    `;

    await sendWelcomeRegistrationEmail(email, username);

    return NextResponse.json(
      { message: "User registration success" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Failed to register user" },
      { status: 500 },
    );
  }
}

export { handler as POST, handler as GET };
