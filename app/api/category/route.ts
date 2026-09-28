import { NextResponse, NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { currentAdminPrivyId, requireAdminSession } from "@/lib/admin-auth";
import { withAdminAudit } from "@/lib/audit/admin-events";
import { cacheHeaders, cacheTags } from "@/lib/cache";
import { invalidateCategoryCaches } from "@/lib/cache/invalidation";
import {
  findCategoryByTitle,
  getAllCategories,
  searchCategoriesByTag,
  searchCategoriesByTitle,
  type StreamCategory,
} from "@/lib/reference-data/categories";

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
    const createdCategory = await withAdminAudit(
      { actorId: await currentAdminPrivyId(), action: "category_created", targetType: "category", targetId: String(title) },
      async tx => {
        const { rows } = await tx.sql`
          INSERT INTO stream_categories (title, description, tags, "imageurl", created_at)
          VALUES (${title}, ${description || null}, ${tags || null}, ${imageurl || null}, CURRENT_TIMESTAMP)
          RETURNING id, title, description, tags, "imageurl"
        `;
        return { result: rows[0], beforeState: null, afterState: { title: rows[0].title, description: rows[0].description, tags: rows[0].tags, imageurl: rows[0].imageurl } };
      }
    );
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

function summary({ id, title, tags, imageurl }: StreamCategory) {
  return { id, title, tags, imageurl };
}

// TO GET CATEGORIES (ALL, BY SEARCH AND SINGLE BY ID)
// Reference data (#1417): every variant is filtered from one cached copy of the
// table (lib/reference-data/categories.ts). Responses are identical for every
// caller and are held by the CDN for a day under the `categories` tag, which
// POST/PATCH/DELETE below purge.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const title = searchParams.get("title"); // for category title search
    const tag = searchParams.get("tag"); // for tag search
    const id = searchParams.get("id"); // to get single category by ID/title

    const headers = cacheHeaders("referenceData", {
      tags: [cacheTags.categories()],
    });

    // Get specific category by title
    if (id) {
      const category = await findCategoryByTitle(id);
      if (!category) {
        return NextResponse.json(
          { success: false, error: "Category not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { success: true, category: summary(category) },
        { headers }
      );
    }

    const categories = title
      ? await searchCategoriesByTitle(title)
      : tag
        ? await searchCategoriesByTag(tag)
        : await getAllCategories();

    return NextResponse.json(
      { success: true, categories: categories.map(summary) },
      { headers }
    );
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
    // Omitted tags keep the current ones (COALESCE); `tags: []` clears them.
    const tags = Array.isArray(body.tags) ? body.tags : null;

    await withAdminAudit(
      { actorId: await currentAdminPrivyId(), action: "category_updated", targetType: "category", targetId: titleParams },
      async tx => {
        const { rows: beforeRows } = await tx.sql`SELECT title, description, tags, imageurl, is_active FROM stream_categories WHERE LOWER(title) = ${titleParams.toLowerCase()} FOR UPDATE`;
        const { rows } = await tx.sql`
          UPDATE stream_categories
          SET title = COALESCE(${title}, title), description = COALESCE(${description}, description),
              tags = COALESCE(${tags}, tags), imageurl = COALESCE(${imageurl}, imageurl),
              is_active = COALESCE(${is_active}, is_active)
          WHERE LOWER(title) = ${titleParams.toLowerCase()}
          RETURNING title, description, tags, imageurl, is_active
        `;
        return { result: rows[0], beforeState: beforeRows[0] ?? null, afterState: rows[0] ?? null };
      }
    );
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

    await withAdminAudit(
      { actorId: await currentAdminPrivyId(), action: "category_deleted", targetType: "category", targetId: title },
      async tx => {
        const { rows } = await tx.sql`DELETE FROM stream_categories WHERE LOWER(title) = ${title.toLowerCase()} RETURNING title, description, tags, imageurl, is_active`;
        return { result: undefined, beforeState: rows[0] ?? null, afterState: null };
      }
    );
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
