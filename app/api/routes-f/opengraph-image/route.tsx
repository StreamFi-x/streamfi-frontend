/**
 * GET /api/routes-f/opengraph-image (#1549)
 *
 * Dynamically renders an OG image for a channel or clip, given
 * ?type=channel|clip&id=<identifier>. A thin, explicit routes-f wrapper
 * around the same rendering approach already used by the file-convention
 * generators (app/[username]/opengraph-image.tsx,
 * app/[username]/clips/[id]/opengraph-image.tsx) — this route exists for
 * callers that want to fetch an OG image for an arbitrary StreamFi
 * channel/clip id without needing to know which page path it maps to.
 *
 * Uses next/og's ImageResponse, which renders via Satori.
 */

import { NextRequest, NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { resolveOgImageData } from "./resolve";
import type { ChannelOgData, ClipOgData } from "./types";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

function ChannelImage({ data }: { data: ChannelOgData }) {
  return (
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
      {data.isLive && (
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
      <div
        style={{
          fontSize: "56px",
          fontWeight: "800",
          color: "white",
          marginBottom: "12px",
          display: "flex",
        }}
      >
        {data.displayName}
      </div>
      <div
        style={{
          fontSize: "26px",
          color: "rgba(255,255,255,0.6)",
          display: "flex",
        }}
      >
        {data.streamTitle || "Streaming on StreamFi"}
      </div>
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
    </div>
  );
}

function ClipImage({ data }: { data: ClipOgData }) {
  const title =
    data.clipTitle.length > 60 ? data.clipTitle.slice(0, 57) + "…" : data.clipTitle;

  return (
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
      {data.thumbnailUrl && (
        <img
          src={data.thumbnailUrl}
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
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to top, rgba(7,6,15,0.95) 0%, rgba(7,6,15,0.5) 50%, rgba(7,6,15,0.15) 100%)",
          display: "flex",
        }}
      />
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
            fontSize: "28px",
            fontWeight: "600",
            color: "rgba(255,255,255,0.85)",
            marginBottom: "16px",
            display: "flex",
          }}
        >
          {data.displayName}
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
          {title}
        </div>
      </div>
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
    </div>
  );
}

export async function GET(req: NextRequest): Promise<Response> {
  const type = req.nextUrl.searchParams.get("type");
  const id = req.nextUrl.searchParams.get("id");

  const result = resolveOgImageData({ type, id });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const element =
    result.data.kind === "channel" ? (
      <ChannelImage data={result.data} />
    ) : (
      <ClipImage data={result.data} />
    );

  return new ImageResponse(element, {
    ...size,
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
