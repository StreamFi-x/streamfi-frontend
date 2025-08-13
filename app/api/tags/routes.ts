import { NextResponse, NextRequest } from "next/server";
import { sql } from "@vercel/postgres";

// TO CREATE TAGS
export async function POST(req: NextRequest) {
  try {
    const { title, visibility } = await req.json();

    if (!title) {
      return NextResponse.json(
        { success: false, error: "Title is required" },
        { status: 400 }
      );
    }

    const result = await sql`
            INSERT INTO tags (title, visibility)
            VALUES (${title}, ${visibility || null})
            ON CONFLICT (title) DO NOTHING
            RETURNING *
        `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Tag already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, tag: result.rows[0] });
  } catch (error) {
    console.error("Error creating tag:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create tag" },
      { status: 500 }
    );
  }
}

// TO UPDATE A TAG
export async function PATCH(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const title = searchParams.get("title");
    const { newTitle, visibility } = await req.json();

    if (!title) {
      return NextResponse.json(
        { success: false, error: "Title is required" },
        { status: 400 }
      );
    }

    const result = await sql`
            UPDATE tags
            SET title = ${newTitle || title}, visibility = ${visibility || null}, created_at = CURRENT_TIMESTAMP
            WHERE LOWER(title) = ${title.toLowerCase()}
            RETURNING *
        `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Tag not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, tag: result.rows[0] });
  } catch (error) {
    console.error("Error updating tag:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update tag" },
      { status: 500 }
    );
  }
}

// TO GET ALL TAGS OR A TAG BY TITLE
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const title = searchParams.get("title");

    let result;

    // Basic test to confirm DB works
    const testResult = await sql`SELECT * FROM tags LIMIT 1`;
    console.log("Test result:", testResult.rows);

    // Search by title (live match)
    if (title) {
      result = await sql`
            SELECT id, title, visibility
            FROM tags
            WHERE LOWER(title) LIKE ${"%" + title.toLowerCase() + "%"}
            ORDER BY created_at ASC
            `;

      return NextResponse.json({ success: true, tags: result.rows });
    }

    //To get all tags (default)
    result = await sql`
            SELECT id, title, visibility
            FROM tags
            ORDER BY created_at ASC
        `;

    return NextResponse.json({ success: true, tags: result.rows });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

//TO DELETE A TAG
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const title = searchParams.get("title");

    if (!title) {
      return NextResponse.json(
        { success: false, error: "Title is required" },
        { status: 400 }
      );
    }

    const result = await sql`
            DELETE FROM tags WHERE LOWER(title) = ${title.toLowerCase()} RETURNING *
        `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Tag not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, deleted: result.rows[0] });
  } catch (error) {
    console.error("Error deleting tag:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete tag" },
      { status: 500 }
    );
  }
}
