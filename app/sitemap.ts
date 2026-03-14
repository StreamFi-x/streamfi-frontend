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

  let userRoutes: MetadataRoute.Sitemap = [];
  try {
    const { rows } = await sql`
      SELECT username, updated_at
      FROM users
      ORDER BY total_views DESC
      LIMIT 500
    `;
    userRoutes = rows.map(r => ({
      url: `${BASE}/${r.username}`,
      lastModified: r.updated_at ? new Date(r.updated_at) : new Date(),
      priority: 0.6,
      changeFrequency: "daily" as const,
    }));
  } catch {
    // DB unavailable during build — sitemap still serves static routes
  }

  return [...statics, ...userRoutes];
}
