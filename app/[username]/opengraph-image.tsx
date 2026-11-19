import { ImageResponse } from "next/og";
import { sql } from "@vercel/postgres";
import { unstable_cache } from "next/cache";
import { CACHE_POLICIES, cacheTags } from "@/lib/cache";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

interface Props {
  params: Promise<{ username: string }>;
}

type UserRow = {
  username: string;
  avatar: string | null;
  bio: string | null;
  is_live: boolean;
  current_viewers: number;
  follower_count: number;
  creator: Record<string, any> | null;
};

// Same caching contract as app/[username]/layout.tsx: the per-user tag lets
// profile writes purge the entry (lib/cache/invalidation.ts), and the TTL
// bounds live-status staleness for the LIVE badge / viewer count.
const fetchUser = (slug: string): Promise<UserRow | null> =>
  unstable_cache(
    async (): Promise<UserRow | null> => {
      try {
        const { rows } = await sql`
          SELECT u.username, u.avatar, u.bio, u.is_live, u.current_viewers,
                 u.creator,
                 (SELECT COUNT(*)::int FROM user_follows
                   WHERE followee_id = u.id) AS follower_count
          FROM users u
          WHERE LOWER(u.username) = ${slug} AND u.deleted_at IS NULL
          LIMIT 1
        `;
        return (rows[0] as UserRow) ?? null;
      } catch {
        return null;
      }
    },
    ["og-image-profile", slug],
    {
      revalidate: CACHE_POLICIES.publicProfile.appTtlSeconds,
      tags: [cacheTags.userByName(slug)],
    }
  )();

function compactNumber(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return String(n);
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export default async function Image({ params }: Props) {
  const { username } = await params;
  const user = await fetchUser(username.toLowerCase());

  const name = user?.username ?? username;
  const avatarUrl = user?.avatar ?? null;
  const bio = user?.bio?.trim() ?? "";
  const isLive = user?.is_live ?? false;
  const viewers = user?.current_viewers ?? 0;
  const followers = user?.follower_count ?? 0;
  const streamTitle =
    user?.creator?.streamTitle?.trim() || user?.creator?.title?.trim() || "";

  const subtitle = isLive
    ? streamTitle || `${name} is live on StreamFi`
    : bio || "Streaming on StreamFi";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-end",
          background:
            "linear-gradient(135deg, #07060f 0%, #1a0a2e 50%, #07060f 100%)",
          padding: "60px",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        {/* Purple glow accent */}
        <div
          style={{
            position: "absolute",
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            background:
              "radial-gradient(ellipse at 30% 50%, rgba(172,57,242,0.25) 0%, transparent 60%)",
            display: "flex",
          }}
        />

        {/* LIVE badge with viewer count */}
        {isLive && (
          <div
            style={{
              position: "absolute",
              top: "50px",
              right: "60px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div
              style={{
                background: "#dc2626",
                color: "white",
                fontSize: "22px",
                fontWeight: "700",
                padding: "8px 18px",
                borderRadius: "6px",
                letterSpacing: "2px",
                display: "flex",
              }}
            >
              LIVE
            </div>
            {viewers > 0 && (
              <div
                style={{
                  background: "rgba(255,255,255,0.1)",
                  color: "white",
                  fontSize: "22px",
                  fontWeight: "600",
                  padding: "8px 18px",
                  borderRadius: "6px",
                  display: "flex",
                }}
              >
                {compactNumber(viewers)} watching
              </div>
            )}
          </div>
        )}

        {/* Avatar / initial */}
        <div
          style={{
            width: "112px",
            height: "112px",
            borderRadius: "50%",
            overflow: "hidden",
            border: "3px solid #ac39f2",
            marginBottom: "28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#ac39f2",
          }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={name}
              width={112}
              height={112}
              style={{ objectFit: "cover", width: "100%", height: "100%" }}
            />
          ) : (
            <span style={{ fontSize: "48px", fontWeight: "800", color: "white" }}>
              {name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Username */}
        <div
          style={{
            fontSize: "58px",
            fontWeight: "800",
            color: "white",
            marginBottom: "14px",
            display: "flex",
          }}
        >
          {truncate(name, 24)}
        </div>

        {/* Bio / live status line */}
        <div
          style={{
            fontSize: "26px",
            color: "rgba(255,255,255,0.6)",
            marginBottom: "30px",
            display: "flex",
          }}
        >
          {truncate(subtitle, 96)}
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              background: "rgba(172,57,242,0.15)",
              border: "1px solid rgba(172,57,242,0.5)",
              color: "#e9d5ff",
              fontSize: "22px",
              fontWeight: "600",
              padding: "8px 18px",
              borderRadius: "999px",
              display: "flex",
            }}
          >
            {compactNumber(followers)} followers
          </div>
          {isLive && streamTitle && (
            <div
              style={{
                background: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.75)",
                fontSize: "22px",
                fontWeight: "600",
                padding: "8px 18px",
                borderRadius: "999px",
                display: "flex",
              }}
            >
              {truncate(streamTitle, 40)}
            </div>
          )}
        </div>

        {/* StreamFi wordmark bottom-right */}
        <div
          style={{
            position: "absolute",
            bottom: "48px",
            right: "60px",
            fontSize: "24px",
            fontWeight: "700",
            color: "#ac39f2",
            display: "flex",
          }}
        >
          StreamFi
        </div>

        {/* Bottom purple line */}
        <div
          style={{
            position: "absolute",
            bottom: "0",
            left: "0",
            width: "100%",
            height: "4px",
            background: "linear-gradient(90deg, #ac39f2 0%, #7c3aed 100%)",
            display: "flex",
          }}
        />
      </div>
    ),
    {
      ...size,
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
      },
    }
  );
}
