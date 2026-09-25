import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import {
  CACHE_POLICIES,
  cacheHeaders,
  cacheKey,
  cacheTags,
  cached,
} from "@/lib/cache";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ title: string }> }
) {
  const { title } = await params;

  try {
    const normalizedTitle = title.toLowerCase();
    const rows = await cached(
      {
        key: cacheKey("category-detail", normalizedTitle),
        tags: [cacheTags.categories()],
        ttlSeconds: CACHE_POLICIES.referenceData.appTtlSeconds,
      },
      async () =>
        (
          await sql`
            SELECT id, title, description, tags, imageurl
            FROM stream_categories
            WHERE LOWER(title) = ${normalizedTitle}
            LIMIT 1
          `
        ).rows
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, category: rows[0] },
      { headers: cacheHeaders("referenceData") }
    );
  } catch (error) {
    console.error("Error fetching category by title:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch category" },
      { status: 500 }
    );
  }
}
