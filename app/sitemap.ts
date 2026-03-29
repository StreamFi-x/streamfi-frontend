import { sql } from "@vercel/postgres";
import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://streamfi.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statics: MetadataRoute.Sitemap = [
    {
      url: BASE,
      lastModified: new Date(),
      priority: 1.0,
      changeFrequency: "daily",
    },
    {
      url: `${BASE}/browse`,
      lastModified: new Date(),
      priority: 0.8,
      changeFrequency: "hourly",
    },
    {
      url: `${BASE}/explore`,
      lastModified: new Date(),
      priority: 0.8,
      changeFrequency: "hourly",
    },
  ];

  let userRoutes: MetadataRoute.Sitemap = [];
  let clipRoutes: MetadataRoute.Sitemap = [];

  try {
    const { rows: userRows } = await sql`
      SELECT username, updated_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 500
    `;
    userRoutes = userRows.map(u => ({
      url: `${BASE}/${u.username}`,
      lastModified: u.updated_at ? new Date(u.updated_at) : new Date(),
      priority: 0.7,
      changeFrequency: "daily" as const,
    }));

    const { rows: clipRows } = await sql`
      SELECT r.id, u.username, r.updated_at
      FROM stream_recordings r
      JOIN users u ON u.id = r.user_id
      WHERE r.status = 'ready'
      ORDER BY r.created_at DESC
      LIMIT 1000
    `;
    clipRoutes = clipRows.map(r => ({
      url: `${BASE}/${r.username}/clips/${r.id}`,
      lastModified: r.updated_at ? new Date(r.updated_at) : new Date(),
      priority: 0.5,
      changeFrequency: "monthly" as const,
    }));
  } catch {
    // Return statics on DB error to avoid breaking the sitemap
  }

  return [...statics, ...userRoutes, ...clipRoutes];
}
