import { ImageResponse } from "next/og";
import { sql } from "@vercel/postgres";

export const runtime = "edge";
export const alt = "Live stream on StreamFi";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  let playbackId: string | null = null;
  let avatar: string | null = null;
  let streamTitle = `${username} is live`;

  try {
    const { rows } = await sql`
      SELECT avatar, mux_playback_id, stream_title
      FROM users
      WHERE username = ${username}
      LIMIT 1
    `;
    if (rows[0]) {
      avatar = rows[0].avatar;
      playbackId = rows[0].mux_playback_id;
      streamTitle = rows[0].stream_title || streamTitle;
    }
  } catch {
    // use defaults
  }

  const bgImage = playbackId
    ? `https://image.mux.com/${playbackId}/thumbnail.jpg`
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#0f0f0f",
        }}
      >
        {bgImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bgImage}
            alt=""
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.6,
            }}
          />
        )}

        {/* LIVE badge — top-left */}
        <div
          style={{
            position: "absolute",
            top: 32,
            left: 32,
            backgroundColor: "#e53e3e",
            color: "white",
            fontSize: 28,
            fontWeight: 700,
            padding: "8px 20px",
            borderRadius: 8,
            display: "flex",
          }}
        >
          LIVE
        </div>

        {/* StreamFi wordmark — top-right */}
        <div
          style={{
            position: "absolute",
            top: 32,
            right: 32,
            color: "white",
            fontSize: 28,
            fontWeight: 700,
            display: "flex",
          }}
        >
          StreamFi
        </div>

        {/* Bottom gradient overlay with streamer info */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "60px 32px 44px",
            background:
              "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {/* Avatar + username row */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {avatar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt=""
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
            )}
            <span style={{ color: "white", fontSize: 32, fontWeight: 600 }}>
              {username}
            </span>
          </div>

          {/* Stream title */}
          <span style={{ color: "#e2e8f0", fontSize: 24, fontWeight: 400 }}>
            {streamTitle}
          </span>
        </div>

        {/* Purple bottom accent line */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 6,
            backgroundColor: "#7c3aed",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
