import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const usernameQuery =
    req.nextUrl.searchParams.get("username")?.toLowerCase() ?? "";
  let username = usernameQuery || "streamer";
  let avatar: string | null = null;

  if (usernameQuery) {
    try {
      const { rows } = await sql`
        SELECT username, avatar
        FROM users
        WHERE LOWER(username) = ${usernameQuery}
        LIMIT 1
      `;
      if (rows[0]) {
        username = rows[0].username;
        avatar = rows[0].avatar ?? null;
      }
    } catch {
      // Ignore DB lookup failure and render fallback.
    }
  }

  return new ImageResponse(
    <div
      style={{
        width: "1280px",
        height: "720px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background:
          "linear-gradient(130deg, rgb(8, 13, 25) 0%, rgb(15, 34, 61) 45%, rgb(5, 11, 20) 100%)",
        color: "white",
        padding: "56px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        <div
          style={{
            fontSize: "24px",
            fontWeight: 700,
            color: "#73e8ff",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          StreamFi
        </div>
        <div style={{ fontSize: "64px", fontWeight: 800 }}>{username}</div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "rgba(255, 86, 86, 0.2)",
            border: "2px solid rgba(255, 86, 86, 0.7)",
            borderRadius: "999px",
            width: "fit-content",
            padding: "8px 18px",
            fontSize: "22px",
            fontWeight: 700,
          }}
        >
          Offline
        </div>
        <div style={{ fontSize: "24px", color: "rgba(255,255,255,0.8)" }}>
          Follow to get notified when they go live.
        </div>
      </div>

      <div
        style={{
          width: "220px",
          height: "220px",
          borderRadius: "999px",
          overflow: "hidden",
          border: "6px solid rgba(115, 232, 255, 0.65)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(255,255,255,0.08)",
          fontSize: "80px",
          fontWeight: 800,
        }}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt={username}
            width={220}
            height={220}
            style={{ objectFit: "cover" }}
          />
        ) : (
          (username[0]?.toUpperCase() ?? "S")
        )}
      </div>
    </div>,
    {
      width: 1280,
      height: 720,
      headers: {
        "Cache-Control":
          "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
