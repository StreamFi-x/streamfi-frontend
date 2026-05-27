import { type NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

const RESERVED = [
  "admin", "api", "dashboard", "settings", "explore",
  "browse", "onboarding", "streamfi", "support", "help",
];

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

function buildSuggestions(base: string): string[] {
  const clean = base.toLowerCase().replace(/[^a-z0-9_]/g, "");
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  return [`${clean}_streams`, `${clean}_live`, `${clean}${suffix}`];
}

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username") ?? "";

  if (!USERNAME_RE.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3–30 characters: letters, numbers, underscores only" },
      { status: 400 }
    );
  }

  if (RESERVED.includes(username.toLowerCase())) {
    return NextResponse.json(
      { available: false, suggestions: buildSuggestions(username), reason: "reserved" },
      { status: 200 }
    );
  }

  try {
    const { rows } = await sql`
      SELECT 1 FROM users WHERE lower(username) = lower(${username}) LIMIT 1
    `;

    const available = rows.length === 0;
    return NextResponse.json({
      available,
      suggestions: available ? [] : buildSuggestions(username),
    });
  } catch (error) {
    console.error("[routes-f register/check GET]", error);
    return NextResponse.json({ error: "Failed to check username" }, { status: 500 });
  }
}
