/**
 * Types for GET /api/routes-f/playback-quality
 *
 * Models the available video renditions for a viewer's stream session,
 * matching realistic Mux-like HLS rendition data shapes.
 */

/** A single playback quality rendition */
export interface PlaybackRendition {
  /** Human-readable label shown in the UI, e.g. "1080p", "720p", "Auto" */
  label: string;
  /** Resolution string in WxH format, e.g. "1920x1080" */
  resolution: string;
  /** Estimated bandwidth in kilobits per second */
  bandwidth_kbps: number;
}

/**
 * Connection type hint sent by the viewer's client.
 * Maps loosely to the Network Information API `effectiveType` values,
 * plus an explicit "wifi" bucket used on mobile clients.
 */
export type ConnectionType = "wifi" | "cellular" | "4g" | "3g" | "2g" | "slow-2g";

/** Response shape for GET /api/routes-f/playback-quality */
export interface PlaybackQualityResponse {
  options: PlaybackRendition[];
  default: string;
}
