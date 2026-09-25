import type { OgImageData } from "./types";

/**
 * Seed data this mock route resolves against. Real channel/clip data
 * lives behind the file-convention opengraph-image.tsx generators at
 * app/[username]/opengraph-image.tsx and
 * app/[username]/clips/[id]/opengraph-image.tsx (both query @vercel/postgres
 * directly) — this route is a separate, explicit routes-f endpoint for
 * callers that want to fetch an OG image for an arbitrary StreamFi URL
 * without knowing which file-convention page it maps to, so it uses the
 * same in-memory-seed-data convention as the rest of routes-f rather than
 * a second real DB connection.
 */
const CHANNELS: Record<string, { displayName: string; isLive: boolean; streamTitle: string | null }> = {
  moonshot_dev: {
    displayName: "moonshot_dev",
    isLive: true,
    streamTitle: "Building on Stellar",
  },
  stellar_samurai: {
    displayName: "stellar_samurai",
    isLive: false,
    streamTitle: null,
  },
};

const CLIPS: Record<string, { displayName: string; clipTitle: string; thumbnailUrl: string | null }> = {
  clip_001: {
    displayName: "moonshot_dev",
    clipTitle: "Soroban deploy in 60s",
    thumbnailUrl: "https://image.mux.com/clip_001_playback/thumbnail.jpg",
  },
  clip_002: {
    displayName: "stellar_samurai",
    clipTitle: "XLM price analysis",
    thumbnailUrl: null,
  },
};

export interface ResolveParams {
  type: string | null;
  id: string | null;
}

export type ResolveResult =
  | { ok: true; data: OgImageData }
  | { ok: false; error: string };

/**
 * Resolves a routes-f/opengraph-image request's `type`+`id` query params to
 * the data its ImageResponse render needs, or a validation error. Kept as a
 * plain function (no NextRequest/ImageResponse dependency) so it's directly
 * unit-testable — ImageResponse itself does real font shaping and isn't
 * meaningfully unit-testable, matching the rest of this repo's ImageResponse
 * routes (e.g. preview/placeholder/route.tsx), none of which have tests.
 */
export function resolveOgImageData({ type, id }: ResolveParams): ResolveResult {
  if (!type || (type !== "channel" && type !== "clip")) {
    return { ok: false, error: "type must be 'channel' or 'clip'" };
  }
  if (!id) {
    return { ok: false, error: "id is required" };
  }

  if (type === "channel") {
    const channel = CHANNELS[id];
    if (!channel) {
      // Unknown channel still renders — a generic OG image beats a broken
      // link preview for a channel that exists but isn't in this mock's
      // seed set.
      return {
        ok: true,
        data: { kind: "channel", displayName: id, isLive: false, streamTitle: null },
      };
    }
    return { ok: true, data: { kind: "channel", ...channel } };
  }

  const clip = CLIPS[id];
  if (!clip) {
    return {
      ok: true,
      data: {
        kind: "clip",
        displayName: "StreamFi",
        clipTitle: "Clip",
        thumbnailUrl: null,
      },
    };
  }
  return { ok: true, data: { kind: "clip", ...clip } };
}
