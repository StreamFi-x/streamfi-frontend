import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { sql } from "@vercel/postgres";

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function PATCH(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  let body: { socialLinks?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { socialLinks } = body;
  if (!Array.isArray(socialLinks)) {
    return NextResponse.json({ error: "socialLinks must be an array" }, { status: 400 });
  }

  if (socialLinks.length > 6) {
    return NextResponse.json(
      { error: "Maximum of 6 social links allowed" },
      { status: 400 }
    );
  }

  const cleanLinks: Array<{ platform?: string; url: string }> = [];

  for (const item of socialLinks) {
    let url = "";
    let platform: string | undefined = undefined;

    if (typeof item === "string") {
      url = item.trim();
    } else if (typeof item === "object" && item !== null && "url" in item && typeof item.url === "string") {
      url = item.url.trim();
      if ("platform" in item && typeof item.platform === "string") {
        platform = item.platform.trim();
      }
    } else {
      return NextResponse.json({ error: "Invalid social link item format" }, { status: 400 });
    }

    if (!isValidUrl(url)) {
      return NextResponse.json(
        { error: `Invalid URL format: ${url}` },
        { status: 400 }
      );
    }

    cleanLinks.push(platform ? { platform, url } : { url });
  }

  const jsonValue = JSON.stringify(cleanLinks);

  try {
    await sql`
      UPDATE users
      SET socialLinks = ${jsonValue}::jsonb,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${session.userId}
    `;
  } catch {
    // Fallback if update by wallet
    if (session.wallet) {
      try {
        await sql`
          UPDATE users
          SET socialLinks = ${jsonValue}::jsonb,
              updated_at = CURRENT_TIMESTAMP
          WHERE wallet = ${session.wallet}
        `;
      } catch {
        // Fallback
      }
    }
  }

  return NextResponse.json(
    {
      success: true,
      socialLinks: cleanLinks,
    },
    { status: 200 }
  );
}
