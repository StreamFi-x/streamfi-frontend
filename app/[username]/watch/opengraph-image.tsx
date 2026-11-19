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
  is_live: boolean;
  current_viewers: number;
  mux_playback_id: string | null;
  stream_privacy: string | null;
  creator: Record<string, any> | null;
};

// Same caching contract as app/[username]/watch/layout.tsx. The short TTL
// keeps the LIVE badge and viewer count fresh; the per-user tag lets profile
// and stream writes purge the entry (lib/cache/invalidation.ts).
const fetchWatchUser = (slug: string): Promise<UserRow | null> =>
  unstable_cache(
    async (): Promise<UserRow | null> => {
      try {
        const { rows } = await sql`
          SELECT username, avatar, is_live, current_viewers, mux_playback_id,
                 stream_privacy, creator
          FROM users
          WHERE LOWER(username) = ${slug} AND deleted_at IS NULL
          LIMIT 1
        `;
        return (rows[0] as UserRow) ?? null;
      } catch {
        return null;
      }
    },
    ["og-image-watch", slug],
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
  const user = await fetchWatchUser(username.toLowerCase());

  const name = user?.username ?? username;
  const avatarUrl = user?.avatar ?? null;
  const isLive = user?.is_live ?? false;
  const viewers = user?.current_viewers ?? 0;
  const isPublic = (user?.stream_privacy ?? "public") === "public";
  const streamTitle =
    user?.creator?.streamTitle?.trim() ||
    user?.creator?.title?.trim() ||
    `${name}'s Live Stream`;

  // Privacy posture matches watch/layout.tsx metadata: the real video frame
  // only appears for public streams; anything else falls back to the
  // creator-set thumbnail or the plain branded background.
  const customThumb: string | null = user?.creator?.thumbnail ?? null;
  const muxThumb =
    isLive && isPublic && user?.mux_playback_id
      ? `https://image.mux.com/${user.mux_playback_id}/thumbnail.jpg?width=1200&height=630&fit_mode=smartcrop`
      : null;
  const backgroundUrl = muxThumb ?? customThumb;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          position: "relative",
          fontFamily: "sans-serif",
          overflow: "hidden",
          background:
            "linear-gradient(135deg, #07060f 0%, #1a0a2e 50%, #07060f 100%)",
        }}
      >
        {/* Stream thumbnail / live video frame as full background */}
        {backgroundUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backgroundUrl}
            alt=""
            width={1200}
            height={630}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}

        {/* Dark gradient overlay — bottom-heavy so text stays readable */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(7,6,15,0.95) 0%, rgba(7,6,15,0.5) 50%, rgba(7,6,15,0.2) 100%)",
            display: "flex",
          }}
        />

        {/* Purple glow accent */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            height: "60%",
            background:
              "radial-gradient(ellipse at 20% 100%, rgba(172,57,242,0.2) 0%, transparent 60%)",
            display: "flex",
          }}
        />

        {/* LIVE badge + viewer count */}
        {isLive && (
          <div
            style={{
              position: "absolute",
              top: "44px",
              left: "56px",
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
                  background: "rgba(7,6,15,0.6)",
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

        {/* StreamFi wordmark top-right */}
        <div
          style={{
            position: "absolute",
            top: "44px",
            right: "56px",
            fontSize: "22px",
            fontWeight: "700",
            color: "#ac39f2",
            display: "flex",
          }}
        >
          StreamFi
        </div>

        {/* Streamer + title, anchored bottom-left */}
        <div
          style={{
            position: "absolute",
            bottom: "50px",
            left: "60px",
            right: "60px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                overflow: "hidden",
                border: "2.5px solid #ac39f2",
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
                  width={56}
                  height={56}
                  style={{ objectFit: "cover", width: "100%", height: "100%" }}
                />
              ) : (
                <span
                  style={{
                    fontSize: "26px",
                    fontWeight: "700",
                    color: "white",
                  }}
                >
                  {name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span
              style={{
                fontSize: "28px",
                fontWeight: "600",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {name}
            </span>
          </div>

          <div
            style={{
              fontSize: "46px",
              fontWeight: "800",
              color: "white",
              lineHeight: "1.15",
              display: "flex",
            }}
          >
            {truncate(streamTitle, 60)}
          </div>
        </div>

        {/* Bottom purple line */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
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
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    }
  );
}
