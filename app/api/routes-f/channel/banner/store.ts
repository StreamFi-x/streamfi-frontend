import type { ChannelBanner, FocalPoint } from "./types";
import { DEFAULT_FOCAL_POINT } from "./types";

/**
 * In-memory banner metadata store. State lives only for the lifetime of the
 * process. Each creator has at most one banner record.
 */
const banners = new Map<string, ChannelBanner>();

export function getBanner(creatorId: string): ChannelBanner | null {
  return banners.get(creatorId) ?? null;
}

export function upsertBanner(
  creatorId: string,
  bannerUrl: string,
  focalPoint?: FocalPoint
): ChannelBanner {
  const existing = banners.get(creatorId);
  const record: ChannelBanner = {
    creator_id: creatorId,
    banner_url: bannerUrl,
    focal_point: focalPoint ?? existing?.focal_point ?? DEFAULT_FOCAL_POINT,
    last_updated: new Date().toISOString(),
  };
  banners.set(creatorId, record);
  return record;
}

export function __resetBanners(): void {
  banners.clear();
}

export function isValidFocalPoint(value: unknown): value is FocalPoint {
  if (typeof value !== "object" || value === null) return false;
  const fp = value as { x?: unknown; y?: unknown };
  return (
    typeof fp.x === "number" &&
    Number.isFinite(fp.x) &&
    fp.x >= 0 &&
    fp.x <= 1 &&
    typeof fp.y === "number" &&
    Number.isFinite(fp.y) &&
    fp.y >= 0 &&
    fp.y <= 1
  );
}
