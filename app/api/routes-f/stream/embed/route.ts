import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { signToken } from "@/lib/auth/sign-token";

/**
 * Valid hostname regex covering standard domain names.
 */
const HOSTNAME_REGEX =
  /^(?:[a-zA-Z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,10}$/i;

function isValidHostname(hostname: string): boolean {
  return HOSTNAME_REGEX.test(hostname);
}

/**
 * Generates the embed URL and the HTML snippet for a creator.
 */
function generateEmbedData(username: string, origin: string, settings: any) {
  const secret = process.env.SESSION_SECRET || "fallback-secret-streamfi";
  const token = signToken(
    {
      creator: username,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 day expiration
    },
    secret
  );

  const params = new URLSearchParams();
  params.set("token", token);

  // Embed viewer flags
  if (settings.autoplay) {
    params.set("autoplay", "1");
  }
  if (settings.muted_by_default) {
    params.set("muted", "1");
  }
  if (settings.chat_enabled === false) {
    params.set("chat", "0");
  }

  const embed_url = `${origin}/embed/${username}?${params.toString()}`;
  const suggested_html = `<iframe src="${embed_url}" width="100%" height="100%" frameborder="0" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture"></iframe>`;

  return { embed_url, suggested_html };
}

// ── GET /api/routes-f/stream/embed?creator= ─────────────────────────────────
// Returns embed configuration for a creator's stream (public route).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("creator");

  if (!username) {
    return NextResponse.json(
      { error: "Missing creator parameter" },
      { status: 400 }
    );
  }

  try {
    const { rows } = await sql`
      SELECT creator, username FROM users WHERE username = ${username} LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const { creator = {} } = rows[0];
    const embedSettings = creator.embed_settings || {
      allowed_domains: [],
      chat_enabled: true,
      autoplay: false,
      muted_by_default: true,
    };

    const origin = req.nextUrl.origin;
    const { embed_url, suggested_html } = generateEmbedData(
      username,
      origin,
      embedSettings
    );

    return NextResponse.json({
      settings: embedSettings,
      embed_url,
      suggested_html,
    });
  } catch (err) {
    console.error("[stream/embed:GET] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ── PATCH /api/routes-f/stream/embed ───────────────────────────────────────
// Creator updates their embed settings.
export async function PATCH(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  let body: {
    allowed_domains?: string[];
    chat_enabled?: boolean;
    autoplay?: boolean;
    muted_by_default?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { allowed_domains, chat_enabled, autoplay, muted_by_default } = body;

  // ── Validation ────────────────────────────────────────────────────────────
  if (allowed_domains !== undefined) {
    if (!Array.isArray(allowed_domains)) {
      return NextResponse.json(
        { error: "allowed_domains must be an array" },
        { status: 400 }
      );
    }
    for (const domain of allowed_domains) {
      if (typeof domain !== "string" || !isValidHostname(domain)) {
        return NextResponse.json(
          { error: `Invalid domain format: ${domain}` },
          { status: 400 }
        );
      }
    }
  }

  if (chat_enabled !== undefined && typeof chat_enabled !== "boolean") {
    return NextResponse.json(
      { error: "chat_enabled must be a boolean" },
      { status: 400 }
    );
  }
  if (autoplay !== undefined && typeof autoplay !== "boolean") {
    return NextResponse.json(
      { error: "autoplay must be a boolean" },
      { status: 400 }
    );
  }
  if (muted_by_default !== undefined && typeof muted_by_default !== "boolean") {
    return NextResponse.json(
      { error: "muted_by_default must be a boolean" },
      { status: 400 }
    );
  }

  try {
    const { rows } = await sql`
      SELECT creator, username FROM users WHERE id = ${session.userId} LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { creator = {}, username } = rows[0];
    const currentEmbedSettings = creator.embed_settings || {
      allowed_domains: [],
      chat_enabled: true,
      autoplay: false,
      muted_by_default: true,
    };

    const updatedEmbedSettings = {
      ...currentEmbedSettings,
      ...(allowed_domains !== undefined && { allowed_domains }),
      ...(chat_enabled !== undefined && { chat_enabled }),
      ...(autoplay !== undefined && { autoplay }),
      ...(muted_by_default !== undefined && { muted_by_default }),
    };

    const updatedCreator = {
      ...creator,
      embed_settings: updatedEmbedSettings,
    };

    await sql`
      UPDATE users SET
        creator = ${JSON.stringify(updatedCreator)},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${session.userId}
    `;

    const origin = req.nextUrl.origin;
    const { embed_url, suggested_html } = generateEmbedData(
      username,
      origin,
      updatedEmbedSettings
    );

    return NextResponse.json({
      ok: true,
      settings: updatedEmbedSettings,
      embed_url,
      suggested_html,
    });
  } catch (err) {
    console.error("[stream/embed:PATCH] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
