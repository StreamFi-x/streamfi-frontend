import { NextResponse } from "next/server";
import {
  PALETTE_CATEGORIES,
  normalizeCategory,
  paletteForCategory,
} from "./palettes";
import { PaletteResponse } from "./types";

export async function GET(
  request: Request
): Promise<NextResponse<PaletteResponse | { error: string }>> {
  const url = new URL(request.url);
  const category = url.searchParams.get("category");

  if (!category || category.trim() === "") {
    return NextResponse.json(
      { error: "Missing required query parameter: category" },
      { status: 400 }
    );
  }

  const palette = paletteForCategory(category);

  if (!palette) {
    return NextResponse.json(
      {
        error: `Unknown category: ${category}. Known categories: ${PALETTE_CATEGORIES.join(", ")}`,
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    category: normalizeCategory(category),
    palette,
  });
}
