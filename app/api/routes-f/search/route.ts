import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";

const searchTypeSchema = z.enum([
  "all",
  "users",
  "streams",
  "clips",
  "categories",
]);

const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  type: searchTypeSchema.default("all"),
  limit: z.coerce.number().int().min(1).max(20).default(20),
  cursor: z.string().optional(),
});

type SearchType = z.infer<typeof searchTypeSchema>;

function parseCursor(raw: string | undefined): Record<string, string> {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }

    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") {
        out[key] = value;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function encodeCursor(value: Record<string, string | null>): string | null {
  const normalized = Object.fromEntries(
    Object.entries(value).filter(
      ([, v]) => typeof v === "string" && v.length > 0
    )
  );

  if (Object.keys(normalized).length === 0) {
    return null;
  }

  return Buffer.from(JSON.stringify(normalized), "utf8").toString("base64url");
}

async function searchUsers(q: string, limit: number, cursor?: string) {
  const term = `%${q}%`;
  const { rows } = cursor
    ? await sql`
        SELECT id, username, avatar, bio
        FROM users
        WHERE id > ${cursor}
          AND (username ILIKE ${term} OR COALESCE(bio, '') ILIKE ${term})
        ORDER BY id ASC
        LIMIT ${limit}
      `
    : await sql`
        SELECT id, username, avatar, bio
        FROM users
        WHERE username ILIKE ${term} OR COALESCE(bio, '') ILIKE ${term}
        ORDER BY id ASC
        LIMIT ${limit}
      `;

  const items = rows.map(row => ({
    type: "users" as const,
    id: row.id,
    username: row.username,
    avatar: row.avatar,
    bio: row.bio,
  }));

  const nextCursor =
    rows.length === limit ? (rows[rows.length - 1].id as string) : null;
  return { items, nextCursor };
}

async function searchStreams(q: string, limit: number, cursor?: string) {
  const term = `%${q}%`;
  const { rows } = cursor
    ? await sql`
        SELECT id, username, avatar, is_live, mux_playback_id, creator
        FROM users
        WHERE id > ${cursor}
          AND (
            username ILIKE ${term}
            OR COALESCE(creator->>'streamTitle', '') ILIKE ${term}
            OR COALESCE(creator->>'title', '') ILIKE ${term}
          )
        ORDER BY id ASC
        LIMIT ${limit}
      `
    : await sql`
        SELECT id, username, avatar, is_live, mux_playback_id, creator
        FROM users
        WHERE username ILIKE ${term}
          OR COALESCE(creator->>'streamTitle', '') ILIKE ${term}
          OR COALESCE(creator->>'title', '') ILIKE ${term}
        ORDER BY id ASC
        LIMIT ${limit}
      `;

  const items = rows.map(row => ({
    type: "streams" as const,
    id: row.id,
    username: row.username,
    avatar: row.avatar,
    is_live: row.is_live,
    playback_id: row.mux_playback_id,
    stream_title:
      (row.creator as { streamTitle?: string; title?: string } | null)
        ?.streamTitle ??
      (row.creator as { streamTitle?: string; title?: string } | null)?.title ??
      null,
  }));

  const nextCursor =
    rows.length === limit ? (rows[rows.length - 1].id as string) : null;
  return { items, nextCursor };
}

async function searchCategories(q: string, limit: number, cursor?: string) {
  const term = `%${q}%`;
  const { rows } = cursor
    ? await sql`
        SELECT DISTINCT category
        FROM (
          SELECT COALESCE(creator->>'category', '') AS category
          FROM users
        ) c
        WHERE category <> ''
          AND category ILIKE ${term}
          AND category > ${cursor}
        ORDER BY category ASC
        LIMIT ${limit}
      `
    : await sql`
        SELECT DISTINCT category
        FROM (
          SELECT COALESCE(creator->>'category', '') AS category
          FROM users
        ) c
        WHERE category <> ''
          AND category ILIKE ${term}
        ORDER BY category ASC
        LIMIT ${limit}
      `;

  const items = rows.map(row => ({
    type: "categories" as const,
    id: row.category,
    name: row.category,
  }));

  const nextCursor =
    rows.length === limit ? (rows[rows.length - 1].category as string) : null;
  return { items, nextCursor };
}

async function searchRecordingsAsClips(
  q: string,
  limit: number,
  cursor?: string
) {
  const term = `%${q}%`;
  const { rows } = cursor
    ? await sql`
        SELECT r.id, r.title, r.playback_id, r.created_at, u.username
        FROM stream_recordings r
        JOIN users u ON u.id = r.user_id
        WHERE r.id > ${cursor}
          AND r.status = 'ready'
          AND (
            COALESCE(r.title, '') ILIKE ${term}
            OR u.username ILIKE ${term}
          )
        ORDER BY r.id ASC
        LIMIT ${limit}
      `
    : await sql`
        SELECT r.id, r.title, r.playback_id, r.created_at, u.username
        FROM stream_recordings r
        JOIN users u ON u.id = r.user_id
        WHERE r.status = 'ready'
          AND (
            COALESCE(r.title, '') ILIKE ${term}
            OR u.username ILIKE ${term}
          )
        ORDER BY r.id ASC
        LIMIT ${limit}
      `;

  const items = rows.map(row => ({
    type: "clips" as const,
    id: row.id,
    title: row.title,
    playback_id: row.playback_id,
    creator_username: row.username,
    created_at: row.created_at,
  }));

  const nextCursor =
    rows.length === limit ? (rows[rows.length - 1].id as string) : null;
  return { items, nextCursor };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, searchQuerySchema);
  if (queryResult instanceof Response) {
    return queryResult;
  }

  const { q, type, limit, cursor } = queryResult.data;
  const cursorMap = parseCursor(cursor);

  try {
    if (type !== "all") {
      const byType: Record<
        Exclude<SearchType, "all">,
        () => Promise<{ items: unknown[]; nextCursor: string | null }>
      > = {
        users: () => searchUsers(q, limit, cursorMap.users),
        streams: () => searchStreams(q, limit, cursorMap.streams),
        clips: () => searchRecordingsAsClips(q, limit, cursorMap.clips),
        categories: () => searchCategories(q, limit, cursorMap.categories),
      };

      const result = await byType[type]();
      return NextResponse.json({
        type,
        items: result.items,
        next_cursor: encodeCursor({ [type]: result.nextCursor }),
      });
    }

    const [users, streams, clips, categories] = await Promise.all([
      searchUsers(q, limit, cursorMap.users),
      searchStreams(q, limit, cursorMap.streams),
      searchRecordingsAsClips(q, limit, cursorMap.clips),
      searchCategories(q, limit, cursorMap.categories),
    ]);

    return NextResponse.json({
      type: "all",
      results: {
        users: users.items,
        streams: streams.items,
        clips: clips.items,
        categories: categories.items,
      },
      next_cursor: encodeCursor({
        users: users.nextCursor,
        streams: streams.nextCursor,
        clips: clips.nextCursor,
        categories: categories.nextCursor,
      }),
    });
  } catch (err) {
    console.error("[search] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
