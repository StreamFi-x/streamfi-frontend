import { sql } from "@vercel/postgres";
import type { MetadataRoute } from "next";

const BASE = "https://www.streamfi.media";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statics: MetadataRoute.Sitemap = [
    { url: BASE, priority: 1.0, changeFrequency: "daily" },
    { url: `${BASE}/explore`, priority: 0.9, changeFrequency: "always" },
    { url: `${BASE}/browse/live`, priority: 0.8, changeFrequency: "always" },
    {
      url: `${BASE}/browse/category`,
      priority: 0.7,
      changeFrequency: "weekly",
    },
  ];

  let dynamicRoutes: MetadataRoute.Sitemap = [];
  try {
    const [{ rows: categories }, { rows: liveStreams }, { rows: recordings }] =
      await Promise.all([
      sql`SELECT title FROM stream_categories WHERE is_active = true ORDER BY title LIMIT 500`,
      sql`SELECT username, updated_at FROM users WHERE deleted_at IS NULL AND is_live = true ORDER BY current_viewers DESC LIMIT 500`,
      sql`SELECT r.id, r.created_at, u.username FROM stream_recordings r JOIN users u ON u.id = r.user_id AND u.deleted_at IS NULL WHERE r.status = 'ready' ORDER BY r.created_at DESC LIMIT 500`,
      ]);
    const userRoutes = await sql`
      SELECT username, updated_at
      FROM users
      WHERE deleted_at IS NULL
      ORDER BY total_views DESC
      LIMIT 500
    `;
    const profileRoutes = userRoutes.rows.map(r => ({
      url: `${BASE}/${r.username}`,
      lastModified: r.updated_at ? new Date(r.updated_at) : new Date(),
      priority: 0.6,
      changeFrequency: "daily" as const,
    }));
    dynamicRoutes = [
      ...categories.map(r => ({
        url: `${BASE}/browse/category/${encodeURIComponent(r.title)}`,
        priority: 0.7,
        changeFrequency: "weekly" as const,
      })),
      ...liveStreams.map(r => ({
        url: `${BASE}/${r.username}/watch`,
        lastModified: r.updated_at ? new Date(r.updated_at) : new Date(),
        priority: 0.8,
        changeFrequency: "always" as const,
      })),
      ...recordings.map(r => ({
        url: `${BASE}/${r.username}/clips/${r.id}`,
        lastModified: new Date(r.created_at),
        priority: 0.5,
        changeFrequency: "weekly" as const,
      })),
      ...profileRoutes,
    ];
  } catch {
    // DB unavailable during build — sitemap still serves static routes
  }

  return [...statics, ...dynamicRoutes];
}
