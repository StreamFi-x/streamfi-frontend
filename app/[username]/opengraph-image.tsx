import { ImageResponse } from "next/og";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

interface Props {
  params: Promise<{ username: string }>;
}

export default async function Image({ params }: Props) {
  const { username } = await params;

  let name = username;
  let avatarUrl: string | null = null;
  let isLive = false;
  let streamTitle: string | null = null;

  try {
    const { rows } = await sql`
      SELECT username, avatar, is_live, creator
      FROM users
      WHERE LOWER(username) = ${username.toLowerCase()}
      LIMIT 1
    `;
    const user = rows[0];
    if (user) {
      name = user.username;
      avatarUrl = user.avatar ?? null;
      isLive = user.is_live ?? false;
      streamTitle = user.creator?.streamTitle ?? null;
    }
  } catch {
    // Fallback to username from URL
  }

  return new ImageResponse(
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
        }}
      />

      {/* LIVE badge */}
      {isLive && (
        <div
          style={{
            position: "absolute",
            top: "50px",
            right: "60px",
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
      )}

      {/* Avatar */}
      {avatarUrl && (
        <div
          style={{
            width: "100px",
            height: "100px",
            borderRadius: "50%",
            overflow: "hidden",
            border: "3px solid #ac39f2",
            marginBottom: "24px",
            display: "flex",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl}
            alt={name}
            width={100}
            height={100}
            style={{ objectFit: "cover" }}
          />
        </div>
      )}

      {/* Username */}
      <div
        style={{
          fontSize: "56px",
          fontWeight: "800",
          color: "white",
          marginBottom: "12px",
          display: "flex",
        }}
      >
        {name}
      </div>

      {/* Stream title or tagline */}
      <div
        style={{
          fontSize: "26px",
          color: "rgba(255,255,255,0.6)",
          marginBottom: "32px",
          display: "flex",
        }}
      >
        {streamTitle || "Streaming on StreamFi"}
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
          alignItems: "center",
          gap: "8px",
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
    </div>,
    { ...size }
  );
}
