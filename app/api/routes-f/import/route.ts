/**
 * POST /api/routes-f/import   — start a platform import job
 * GET  /api/routes-f/import?job_id={id}  — poll import status
 *
 * Supported sources: twitch | youtube | json
 *
 * Security:
 *   - Session cookie required (privy or wallet)
 *   - Rate limited: 5 requests/min per IP (general) + 1 import/user/24h (user-level)
 *   - Third-party OAuth tokens are NEVER persisted — used once and discarded
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { createRateLimiter } from "@/lib/rate-limit";
import { verifySession } from "@/lib/auth/verify-session";

// 5 requests per minute per IP
const isIpRateLimited = createRateLimiter(60_000, 5);

// ── Types ──────────────────────────────────────────────────────────────────────

type ImportSource = "twitch" | "youtube" | "json";

interface ImportOptions {
  import_avatar?: boolean;
  import_bio?: boolean;
  import_social_links?: boolean;
  import_categories?: boolean;
  /** When false (default), only fills currently-empty fields */
  overwrite_existing?: boolean;
}

interface ImportRequest {
  source: ImportSource;
  data: Record<string, unknown>;
  options?: ImportOptions;
}

/** Normalised profile data returned by each importer */
interface ImportedProfile {
  bio?: string;
  avatar_url?: string;
  social_links?: Array<{ socialTitle: string; socialLink: string }>;
  /** First entry maps to creator.category */
  categories?: string[];
}

/** Expected shape of a StreamFi JSON export */
interface StreamFiExport {
  bio?: string;
  avatar_url?: string;
  social_links?: Array<{ title: string; url: string }>;
  categories?: string[];
}

// ── Source importers ───────────────────────────────────────────────────────────

function getTwitchClientId(): string {
  const id = process.env.TWITCH_CLIENT_ID;
  if (!id) {
    throw new Error("TWITCH_CLIENT_ID not configured");
  }
  return id;
}

/**
 * Fetches profile from Twitch Helix API using the caller-supplied OAuth token.
 * The token is used once and never stored.
 */
async function importFromTwitch(
  data: Record<string, unknown>
): Promise<ImportedProfile> {
  const accessToken = data.access_token;
  if (typeof accessToken !== "string" || !accessToken) {
    throw new Error("Twitch import requires data.access_token");
  }

  const clientId = getTwitchClientId();
  let response: Response;
  try {
    response = await fetch("https://api.twitch.tv/helix/users", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Client-Id": clientId,
      },
    });
  } catch (err) {
    throw new Error(
      `Failed to reach Twitch API: ${err instanceof Error ? err.message : "network error"}`
    );
  }

  if (!response.ok) {
    // 401 means the token was invalid/expired — surface a clear message
    if (response.status === 401) {
      throw new Error("Twitch access token is invalid or expired");
    }
    throw new Error(`Twitch API returned ${response.status}`);
  }

  const json = await response.json();
  const user = json?.data?.[0];
  if (!user) {
    throw new Error("No Twitch user data returned for this token");
  }

  return {
    bio: user.description || undefined,
    avatar_url: user.profile_image_url || undefined,
    // Twitch Helix /users does not expose social links
    social_links: undefined,
    categories: undefined,
  };
}

/** Decodes HTML entities that appear in meta-tag content.
 * Single-pass replacement prevents double-unescaping (e.g. &amp;lt; → &lt; → <). */
const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

function decodeHTMLEntities(text: string): string {
  return text.replace(
    /&amp;|&lt;|&gt;|&quot;|&#39;/g,
    m => HTML_ENTITIES[m] ?? m
  );
}

/**
 * Fetches public channel metadata from a YouTube channel URL via og: meta tags.
 * No API key required — works with any public channel page.
 */
async function importFromYouTube(
  data: Record<string, unknown>
): Promise<ImportedProfile> {
  const channelUrl = data.channel_url;
  if (typeof channelUrl !== "string" || !channelUrl) {
    throw new Error("YouTube import requires data.channel_url");
  }

  // SSRF guard: only accept YouTube channel URLs
  const ytPattern =
    /^https:\/\/(www\.)?youtube\.com\/(channel\/UC[\w-]{22}|@[\w.-]+|c\/[\w.-]+)\/?$/;
  if (!ytPattern.test(channelUrl)) {
    throw new Error(
      "data.channel_url must be a valid YouTube channel URL (e.g. https://www.youtube.com/@channelname)"
    );
  }

  let html: string;
  try {
    const response = await fetch(channelUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; StreamFi/1.0)" },
    });
    if (!response.ok) {
      throw new Error(`YouTube returned ${response.status}`);
    }
    html = await response.text();
  } catch (err) {
    throw new Error(
      `Failed to fetch YouTube channel: ${err instanceof Error ? err.message : "network error"}`
    );
  }

  // Extract og: meta content — two attribute orderings are possible
  const ogContent = (property: string): string | undefined => {
    const pattern = new RegExp(
      `<meta[^>]+(?:property|name)="${property}"[^>]+content="([^"]*)"` +
        `|<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${property}"`,
      "i"
    );
    const match = html.match(pattern);
    const raw = match?.[1] ?? match?.[2];
    return raw ? decodeHTMLEntities(raw) : undefined;
  };

  return {
    bio: ogContent("og:description") ?? ogContent("description"),
    avatar_url: ogContent("og:image"),
    social_links: undefined,
    categories: undefined,
  };
}

/** Validates and maps a StreamFi-format JSON export to a normalised profile. */
function importFromJson(data: Record<string, unknown>): ImportedProfile {
  const exportData = data as StreamFiExport;

  const hasContent =
    exportData.bio !== undefined ||
    exportData.avatar_url !== undefined ||
    exportData.social_links !== undefined ||
    exportData.categories !== undefined;

  if (!hasContent) {
    throw new Error(
      "JSON export must contain at least one of: bio, avatar_url, social_links, categories"
    );
  }

  if (exportData.bio !== undefined && typeof exportData.bio !== "string") {
    throw new Error("JSON export: bio must be a string");
  }
  if (
    exportData.avatar_url !== undefined &&
    typeof exportData.avatar_url !== "string"
  ) {
    throw new Error("JSON export: avatar_url must be a string");
  }
  if (exportData.social_links !== undefined) {
    if (!Array.isArray(exportData.social_links)) {
      throw new Error(
        "JSON export: social_links must be an array of {title, url} objects"
      );
    }
    for (const link of exportData.social_links) {
      if (
        typeof link !== "object" ||
        link === null ||
        typeof (link as Record<string, unknown>).title !== "string" ||
        typeof (link as Record<string, unknown>).url !== "string"
      ) {
        throw new Error(
          "JSON export: each social_links entry must have string fields title and url"
        );
      }
    }
  }
  if (exportData.categories !== undefined) {
    if (
      !Array.isArray(exportData.categories) ||
      !exportData.categories.every(c => typeof c === "string")
    ) {
      throw new Error("JSON export: categories must be an array of strings");
    }
  }

  return {
    bio: exportData.bio,
    avatar_url: exportData.avatar_url,
    social_links: exportData.social_links?.map(l => ({
      socialTitle: l.title,
      socialLink: l.url,
    })),
    categories: exportData.categories,
  };
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function ensureJobsTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS import_jobs (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     VARCHAR     NOT NULL,
      status      VARCHAR     NOT NULL DEFAULT 'queued',
      source      VARCHAR     NOT NULL,
      result      JSONB,
      error       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

/**
 * Applies the normalised profile to the user row, respecting overwrite_existing.
 * When overwrite_existing is false, only empty/null fields are updated.
 */
async function applyImport(
  userId: string,
  profile: ImportedProfile,
  options: Required<ImportOptions>
): Promise<void> {
  const { rows } = await sql`
    SELECT bio, avatar, sociallinks, creator
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  if (rows.length === 0) {
    throw new Error("User not found");
  }

  const user = rows[0];
  const overwrite = options.overwrite_existing;

  const newBio =
    options.import_bio && profile.bio !== undefined
      ? overwrite || !user.bio
        ? profile.bio
        : user.bio
      : user.bio;

  const newAvatar =
    options.import_avatar && profile.avatar_url !== undefined
      ? overwrite || !user.avatar
        ? profile.avatar_url
        : user.avatar
      : user.avatar;

  let newSocialLinks = user.sociallinks;
  if (options.import_social_links && profile.social_links?.length) {
    const existing: unknown[] = user.sociallinks
      ? typeof user.sociallinks === "string"
        ? JSON.parse(user.sociallinks)
        : user.sociallinks
      : [];
    if (overwrite || existing.length === 0) {
      newSocialLinks = JSON.stringify(profile.social_links);
    }
  }

  let newCreator = user.creator;
  if (options.import_categories && profile.categories?.length) {
    const existingCreator: Record<string, unknown> = user.creator
      ? typeof user.creator === "string"
        ? JSON.parse(user.creator)
        : user.creator
      : {};
    if (overwrite || !existingCreator.category) {
      newCreator = JSON.stringify({
        ...existingCreator,
        category: profile.categories[0],
      });
    }
  }

  await sql`
    UPDATE users
    SET
      bio         = ${newBio},
      avatar      = ${newAvatar},
      sociallinks = ${newSocialLinks},
      creator     = ${
        newCreator
          ? typeof newCreator === "string"
            ? newCreator
            : JSON.stringify(newCreator)
          : null
      },
      updated_at  = CURRENT_TIMESTAMP
    WHERE id = ${userId}
  `;
}

// ── POST /api/routes-f/import ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. IP-level rate limit
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (await isIpRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // 2. Session auth
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  // 3. Parse body
  let body: ImportRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { source, data, options = {} } = body;

  if (!["twitch", "youtube", "json"].includes(source)) {
    return NextResponse.json(
      { error: "source must be one of: twitch, youtube, json" },
      { status: 400 }
    );
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return NextResponse.json(
      { error: "data must be a non-null object" },
      { status: 400 }
    );
  }

  const resolvedOptions: Required<ImportOptions> = {
    import_avatar: options.import_avatar ?? true,
    import_bio: options.import_bio ?? true,
    import_social_links: options.import_social_links ?? true,
    import_categories: options.import_categories ?? true,
    overwrite_existing: options.overwrite_existing ?? false,
  };

  // 4. User-level rate limit: 1 successful or in-flight import per 24 hours
  try {
    await ensureJobsTable();

    const { rows: recent } = await sql`
      SELECT id FROM import_jobs
      WHERE user_id   = ${session.userId}
        AND status   != 'failed'
        AND created_at > NOW() - INTERVAL '24 hours'
      LIMIT 1
    `;

    if (recent.length > 0) {
      return NextResponse.json(
        { error: "Import limit reached. You may import once every 24 hours." },
        { status: 429, headers: { "Retry-After": "86400" } }
      );
    }
  } catch (err) {
    console.error("[import] DB error checking rate limit:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }

  // 5. Create job record
  let jobId: string;
  try {
    const { rows } = await sql`
      INSERT INTO import_jobs (user_id, status, source)
      VALUES (${session.userId}, 'processing', ${source})
      RETURNING id
    `;
    jobId = rows[0].id;
  } catch (err) {
    console.error("[import] Failed to create job record:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }

  // 6. Process import (synchronous — serverless has no true background jobs)
  try {
    let profile: ImportedProfile;

    switch (source) {
      case "twitch":
        profile = await importFromTwitch(data);
        break;
      case "youtube":
        profile = await importFromYouTube(data);
        break;
      case "json":
        profile = importFromJson(data);
        break;
    }

    await applyImport(session.userId, profile, resolvedOptions);

    await sql`
      UPDATE import_jobs
      SET status = 'done', result = ${JSON.stringify({ imported: profile })}, updated_at = NOW()
      WHERE id = ${jobId}
    `;

    return NextResponse.json({ job_id: jobId, status: "done" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[import] Processing failed:", err);

    try {
      await sql`
        UPDATE import_jobs
        SET status = 'failed', error = ${message}, updated_at = NOW()
        WHERE id = ${jobId}
      `;
    } catch (updateErr) {
      console.error("[import] Failed to mark job as failed:", updateErr);
    }

    return NextResponse.json(
      { error: `Import failed: ${message}` },
      { status: 422 }
    );
  }
}

// ── GET /api/routes-f/import?job_id= ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  // 1. IP-level rate limit
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (await isIpRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // 2. Session auth
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  // 3. Validate job_id
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("job_id");

  if (!jobId) {
    return NextResponse.json({ error: "job_id is required" }, { status: 400 });
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(jobId)) {
    return NextResponse.json(
      { error: "Invalid job_id format" },
      { status: 400 }
    );
  }

  // 4. Fetch job (scoped to authenticated user — no cross-user leakage)
  try {
    await ensureJobsTable();

    const { rows } = await sql`
      SELECT id, status, source, result, error, created_at, updated_at
      FROM import_jobs
      WHERE id = ${jobId} AND user_id = ${session.userId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const job = rows[0];
    return NextResponse.json({
      job_id: job.id,
      status: job.status,
      source: job.source,
      result: job.result ?? null,
      error: job.error ?? null,
      created_at: job.created_at,
      updated_at: job.updated_at,
    });
  } catch (err) {
    console.error("[import] DB error fetching job:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
