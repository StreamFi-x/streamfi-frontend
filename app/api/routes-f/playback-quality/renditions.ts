/**
 * Synthetic Mux-like rendition catalog bundled inside this folder.
 *
 * Each entry represents a standard HLS rendition that Mux typically
 * generates. Bandwidth figures are conservative mid-range estimates.
 * The "Auto" option is the adaptive-bitrate rendition (ABR).
 */

import type { PlaybackRendition, ConnectionType } from "./types";

/** All renditions available for a stream session, ordered best → worst */
export const ALL_RENDITIONS: PlaybackRendition[] = [
  { label: "1080p", resolution: "1920x1080", bandwidth_kbps: 4_500 },
  { label: "720p", resolution: "1280x720", bandwidth_kbps: 2_800 },
  { label: "480p", resolution: "854x480", bandwidth_kbps: 1_200 },
  { label: "360p", resolution: "640x360", bandwidth_kbps: 700 },
  { label: "160p", resolution: "284x160", bandwidth_kbps: 230 },
  { label: "Auto", resolution: "adaptive", bandwidth_kbps: 0 },
];

/**
 * Map each connection type hint to the label of the rendition that should
 * be selected as the default.
 *
 * - wifi     → highest quality (1080p)
 * - 4g       → good quality (720p) — reliable but metered
 * - cellular → same as 4g when unspecified
 * - 3g       → medium quality (480p)
 * - 2g       → low quality (360p)
 * - slow-2g  → lowest quality (160p)
 */
const CONNECTION_DEFAULT: Record<ConnectionType, string> = {
  wifi: "1080p",
  cellular: "720p",
  "4g": "720p",
  "3g": "480p",
  "2g": "360p",
  "slow-2g": "160p",
};

/** Fallback when no connection_type hint is provided */
export const FALLBACK_DEFAULT = "Auto";

/**
 * Resolve the default rendition label for a given connection type hint.
 * Falls back to "Auto" (ABR) if the hint is absent or unrecognised.
 */
export function resolveDefault(connectionType?: string | null): string {
  if (!connectionType) return FALLBACK_DEFAULT;
  const mapped = CONNECTION_DEFAULT[connectionType as ConnectionType];
  return mapped ?? FALLBACK_DEFAULT;
}
