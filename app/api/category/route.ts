import { NextResponse, NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  CACHE_POLICIES,
  cacheHeaders,
  cacheKey,
  cacheTags,
  cached,
} from "@/lib/cache";
import { invalidateCategoryCaches } from "@/lib/cache/invalidation";

//TO CREATE A CATEGORY
export async function POST(req: NextRequest) {
  const adminDenied = await requireAdminSession("category");
  if (adminDenied) {
    return adminDenied;
  }

  try {
    const { title, description, tags, imageurl } = await req.json();

    console.log("Category creation request received:", {
      title,
      description,
      tags,
      imageurl,
      timestamp: new Date().toISOString(),
    });

    // Validate input
    if (!title || typeof title !== "string") {
      console.log("Validation failed: title is required");
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Check for duplicate title (case-insensitive)
    console.log("Checking for existing category with same title...");
    const { rows: existingCategories } = await sql`
      SELECT id FROM stream_categories WHERE LOWER(title) = LOWER(${title})
    `;

    if (existingCategories.length > 0) {
      console.log("Duplicate category found:", title);
      return NextResponse.json(
        { error: "Category with this title already exists" },
        { status: 409 }
      );
    }

    // Insert into stream_categories
    console.log("📝 Inserting new category...");
    const { rows: insertedRows } = await sql`
      INSERT INTO stream_categories (title, description, tags, "imageurl", created_at)
      VALUES (
        ${title},
        ${description || null},
        ${tags || null},
        ${imageurl || null},
        CURRENT_TIMESTAMP
      )
      RETURNING id, title, description, tags, "imageurl"
    `;

    const createdCategory = insertedRows[0];
    await invalidateCategoryCaches();

    console.log("Category created successfully:", createdCategory);

    return NextResponse.json(
      {
        success: true,
        data: createdCategory,
        message: "Category created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unhandled category creation error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : "";

    console.log("Error details:", {
      message,
      stack,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        error: "Failed to create category",
        details: message,
      },
      { status: 500 }
    );
  }
}

type CategoryLookup =
  | { by: "id"; value: string }
  | { by: "title"; value: string }
  | { by: "tag"; value: string }
  | { by: "all" };

async function loadCategoryRows(lookup: CategoryLookup) {
  switch (lookup.by) {
    // Get specific category by title
    case "id":
      return (
        await sql`
          SELECT id, title, tags, imageurl
          FROM stream_categories
          WHERE LOWER(title) = ${lookup.value}
          LIMIT 1
        `
      ).rows;
    // Search by title (live match)
    case "title":
      return (
        await sql`
          SELECT id, title, tags, imageurl
          FROM stream_categories
          WHERE LOWER(title) LIKE ${"%" + lookup.value + "%"}
          ORDER BY created_at DESC
        `
      ).rows;
    // Search by tag (live match in tags array)
    case "tag":
      return (
        await sql`
          SELECT id, title, tags, imageurl
          FROM stream_categories
          WHERE EXISTS (
            SELECT 1 FROM UNNEST(tags) AS t
            WHERE LOWER(t) LIKE ${"%" + lookup.value + "%"}
          )
          ORDER BY created_at DESC
        `
      ).rows;
    // Get all categories (default)
    case "all":
      return (
        await sql`
          SELECT id, title, tags, imageurl
          FROM stream_categories
          ORDER BY created_at DESC
        `
      ).rows;
  }
}

// TO GET CATEGORIES (ALL, BY SEARCH AND SINGLE BY ID)
// Reference data: cached for an hour and purged by POST/PATCH/DELETE below.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const title = searchParams.get("title"); // for category title search
    const tag = searchParams.get("tag"); // for tag search
    const id = searchParams.get("id"); // to get single category by ID/title

    const lookup: CategoryLookup = id
      ? { by: "id", value: id.toLowerCase() }
      : title
        ? { by: "title", value: title.toLowerCase() }
        : tag
          ? { by: "tag", value: tag.toLowerCase() }
          : { by: "all" };

    const rows = await cached(
      {
        key: cacheKey(
          "categories",
          lookup.by,
          "value" in lookup ? lookup.value : ""
        ),
        tags: [cacheTags.categories()],
        ttlSeconds: CACHE_POLICIES.referenceData.appTtlSeconds,
      },
      () => loadCategoryRows(lookup)
    );
    const headers = cacheHeaders("referenceData");

    if (lookup.by === "id") {
      if (rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Category not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { success: true, category: rows[0] },
        { headers }
      );
    }

    return NextResponse.json({ success: true, categories: rows }, { headers });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

// TO UPDATE A CATEGORY
export async function PATCH(req: Request) {
  const adminDenied = await requireAdminSession("category");
  if (adminDenied) {
    return adminDenied;
  }

  try {
    const { searchParams } = new URL(req.url);
    const titleParams = searchParams.get("id");
    if (!titleParams) {
      return NextResponse.json(
        { success: false, error: "Missing category ID" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { title, description, imageurl, is_active } = body;
    const tags = Array.isArray(body.tags) ? body.tags : [];

    await sql`
      UPDATE stream_categories
      SET
        title = COALESCE(${title}, title),
        description = COALESCE(${description}, description),
        tags = COALESCE(${tags}, tags),
        imageurl = COALESCE(${imageurl}, imageurl),
        is_active = COALESCE(${is_active}, is_active)
       WHERE LOWER(title) = ${titleParams.toLowerCase()}
    `;
    await invalidateCategoryCaches();

    return NextResponse.json({ success: true, message: "Category updated" });
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update category" },
      { status: 500 }
    );
  }
}

// TO DELETE A CATEGORY
export async function DELETE(req: Request) {
  const adminDenied = await requireAdminSession("category");
  if (adminDenied) {
    return adminDenied;
  }

  try {
    const { searchParams } = new URL(req.url);
    const title = searchParams.get("id");
    if (!title) {
      return NextResponse.json(
        { success: false, error: "Missing category ID" },
        { status: 400 }
      );
    }

    await sql`
      DELETE FROM stream_categories
      WHERE LOWER(title) = ${title.toLowerCase()}
    `;
    await invalidateCategoryCaches();

    return NextResponse.json({ success: true, message: "Category deleted" });
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete category" },
      { status: 500 }
    );
  }
}
