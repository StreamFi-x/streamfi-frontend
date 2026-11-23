import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { createRateLimiter } from "@/lib/rate-limit";
import { apiBadRequest, apiRateLimited, apiSuccess } from "@/lib/api";
import {
  isSupportedLanguageCode,
  SUPPORTED_LANGUAGES,
} from "@/lib/i18n/languages";

const isRateLimited = createRateLimiter(60_000, 30);

function getIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

const VALID_QUALITY = ["auto", "1080p", "720p", "480p", "360p"] as const;
const VALID_THEME = ["dark", "light", "system"] as const;
const VALID_FONT_SIZE = ["small", "medium", "large"] as const;

/**
 * GET  /api/users/preferences  – fetch the caller's preferences (creates defaults if missing)
 * PATCH /api/users/preferences – update one or more preference fields
 */
export async function GET(req: NextRequest) {
  if (await isRateLimited(getIp(req))) {
    return apiRateLimited("Too many requests");
  }

  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  // Upsert defaults on first access
  const { rows } = await sql`
    INSERT INTO user_preferences (user_id)
    VALUES (${session.userId})
    ON CONFLICT (user_id) DO NOTHING
  `.then(
    () =>
      sql`
        SELECT
          user_id,
          stream_quality,
          theme,
          language,
          chat_font_size,
          show_timestamps,
          updated_at
        FROM user_preferences
        WHERE user_id = ${session.userId}
        LIMIT 1
      `
  );

  return apiSuccess({ preferences: rows[0] ?? null }, { legacyFlat: true });
}

export async function PATCH(req: NextRequest) {
  if (await isRateLimited(getIp(req))) {
    return apiRateLimited("Too many requests");
  }

  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const body = await req.json().catch(() => ({}));

  if (
    body.notify_live !== undefined ||
    body.notify_clips !== undefined ||
    body.notify_tips !== undefined
  ) {
    return apiBadRequest(
      "Notification settings must be updated through /api/routes-f/notification-preferences"
    );
  }

  // Validate enum fields
  if (
    body.stream_quality !== undefined &&
    !VALID_QUALITY.includes(body.stream_quality)
  ) {
    return apiBadRequest(
      `stream_quality must be one of: ${VALID_QUALITY.join(", ")}`
    );
  }
  if (body.theme !== undefined && !VALID_THEME.includes(body.theme)) {
    return apiBadRequest(`theme must be one of: ${VALID_THEME.join(", ")}`);
  }
  if (
    body.language !== undefined &&
    (typeof body.language !== "string" ||
      !isSupportedLanguageCode(body.language))
  ) {
    return apiBadRequest(
      `language must be one of: ${SUPPORTED_LANGUAGES.map(({ code }) => code).join(", ")}`
    );
  }
  if (
    body.chat_font_size !== undefined &&
    !VALID_FONT_SIZE.includes(body.chat_font_size)
  ) {
    return apiBadRequest(
      `chat_font_size must be one of: ${VALID_FONT_SIZE.join(", ")}`
    );
  }

  // Ensure row exists
  await sql`INSERT INTO user_preferences (user_id) VALUES (${session.userId}) ON CONFLICT DO NOTHING`;

  const { rows } = await sql`
    UPDATE user_preferences SET
      stream_quality   = COALESCE(${body.stream_quality ?? null}, stream_quality),
      theme            = COALESCE(${body.theme ?? null}, theme),
      language         = COALESCE(${body.language ?? null}, language),
      chat_font_size   = COALESCE(${body.chat_font_size ?? null}, chat_font_size),
      show_timestamps  = COALESCE(${body.show_timestamps ?? null}, show_timestamps),
      updated_at       = CURRENT_TIMESTAMP
    WHERE user_id = ${session.userId}
    RETURNING
      user_id,
      stream_quality,
      theme,
      language,
      chat_font_size,
      show_timestamps,
      updated_at
  `;

  return apiSuccess({ preferences: rows[0] }, { legacyFlat: true });
}
