import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function GET(
  req: NextRequest,
  { params }: { params: { title: string } }
) {
  const title = params.title;

  try {
    const { rows } = await sql`
      SELECT id, title, description, tags, imageurl
      FROM stream_categories
      WHERE LOWER(title) = ${title.toLowerCase()}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, category: rows[0] });
  } catch (error) {
    console.error("Error fetching category by title:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch category" },
      { status: 500 }
    );
  }
}
