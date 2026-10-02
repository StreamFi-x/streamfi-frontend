import { NextRequest, NextResponse } from "next/server";
import { cacheHeaders, cacheTags } from "@/lib/cache";
import { findCategoryByTitle } from "@/lib/reference-data/categories";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ title: string }> }
) {
  const { title } = await params;

  try {
    const category = await findCategoryByTitle(title);

    if (!category) {
      return NextResponse.json(
        { success: false, error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, category },
      {
        headers: cacheHeaders("referenceData", {
          tags: [cacheTags.categories()],
        }),
      }
    );
  } catch (error) {
    console.error("Error fetching category by title:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch category" },
      { status: 500 }
    );
  }
}
