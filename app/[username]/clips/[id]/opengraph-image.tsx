import { ImageResponse } from "next/og";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

interface Props {
  params: Promise<{ username: string; id: string }>;
}

export default async function Image({ params }: Props) {
  const { username, id } = await params;

  let playbackId: string | null = null;
  let recTitle: string | null = null;
  let avatarUrl: string | null = null;
  let displayName = username;

  try {
    const { rows } = await sql`
      SELECT r.playback_id, r.title, u.username, u.avatar
      FROM stream_recordings r
      JOIN users u ON u.id = r.user_id
      WHERE r.id = ${id} AND r.status = 'ready'
      LIMIT 1
    `;
    const rec = rows[0];
    if (rec) {
      playbackId = rec.playback_id ?? null;
      recTitle = rec.title ?? null;
      avatarUrl = rec.avatar ?? null;
      displayName = rec.username ?? username;
    }
  } catch {
    // Fall through to defaults
  }

  const thumbUrl = playbackId
    ? `https://image.mux.com/${playbackId}/thumbnail.jpg?width=1200&height=630&fit_mode=smartcrop`
    : null;

  const title = recTitle ?? `${displayName}'s Past Stream`;

  return new ImageResponse(
    <div
      style={{
        width: "1200px",
        height: "630px",
        display: "flex",
        position: "relative",
        fontFamily: "sans-serif",
        overflow: "hidden",
        background: "#07060f",
      }}
    >
      {/* Mux video thumbnail as full background */}
      {thumbUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl}
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
            "linear-gradient(to top, rgba(7,6,15,0.95) 0%, rgba(7,6,15,0.5) 50%, rgba(7,6,15,0.15) 100%)",
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

      {/* Content anchored to bottom-left */}
      <div
        style={{
          position: "absolute",
          bottom: "50px",
          left: "60px",
          right: "60px",
          display: "flex",
          flexDirection: "column",
          gap: "0px",
        }}
      >
        {/* Streamer row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "16px",
          }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={displayName}
              width={56}
              height={56}
              style={{
                borderRadius: "50%",
                border: "2.5px solid #ac39f2",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "#ac39f2",
                border: "2.5px solid #ac39f2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
                fontWeight: "700",
                color: "white",
              }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <span
            style={{
              fontSize: "28px",
              fontWeight: "600",
              color: "rgba(255,255,255,0.85)",
            }}
          >
            {displayName}
          </span>
        </div>

        {/* Recording title */}
        <div
          style={{
            fontSize: "46px",
            fontWeight: "800",
            color: "white",
            lineHeight: "1.15",
            display: "flex",
          }}
        >
          {title.length > 60 ? title.slice(0, 57) + "…" : title}
        </div>
      </div>

      {/* StreamFi wordmark */}
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
    </div>,
    { ...size }
  );
}
