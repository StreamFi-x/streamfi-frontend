import { ACTIVE_CHANNELS, RECENT_VODS } from "./seedData";
import { RECENT_VOD_WINDOW_DAYS, type ChannelEntry, type VodEntry } from "./types";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://streamfi.app";
}

function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

export function isRecentVod(vod: VodEntry, now: number = Date.now()): boolean {
  const publishedMs = new Date(vod.published_at).getTime();
  if (!Number.isFinite(publishedMs)) return false;
  const ageDays = (now - publishedMs) / (1000 * 60 * 60 * 24);
  return ageDays >= 0 && ageDays <= RECENT_VOD_WINDOW_DAYS;
}

/**
 * Builds an XML sitemap for active (currently live) channels and VODs
 * published within the last RECENT_VOD_WINDOW_DAYS days.
 */
export function buildSitemapXml(
  channels: ChannelEntry[] = ACTIVE_CHANNELS,
  vods: VodEntry[] = RECENT_VODS,
  now: number = Date.now()
): string {
  const origin = siteOrigin();

  const channelUrls = channels
    .filter((c) => c.is_live)
    .map(
      (c) =>
        `  <url>\n` +
        `    <loc>${escapeXml(`${origin}/${c.username}`)}</loc>\n` +
        `    <lastmod>${toDateOnly(c.updated_at)}</lastmod>\n` +
        `    <changefreq>hourly</changefreq>\n` +
        `    <priority>0.9</priority>\n` +
        `  </url>`
    );

  const vodUrls = vods
    .filter((v) => isRecentVod(v, now))
    .map(
      (v) =>
        `  <url>\n` +
        `    <loc>${escapeXml(`${origin}/${v.username}/vod/${v.id}`)}</loc>\n` +
        `    <lastmod>${toDateOnly(v.published_at)}</lastmod>\n` +
        `    <changefreq>weekly</changefreq>\n` +
        `    <priority>0.6</priority>\n` +
        `  </url>`
    );

  const urlElements = [...channelUrls, ...vodUrls].join("\n");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    (urlElements ? `${urlElements}\n` : "") +
    `</urlset>`
  );
}
