/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type CategoryData = {
  category: string;
  streams: number;
  total_hours: number;
  percent: number;
};

type ContentCategoryMix = {
  categories: CategoryData[];
};

const CATEGORIES = ["gaming", "music", "education", "talk", "creative"];

const querySchema = z.object({
  creator_id: z.string().min(1, "creator_id is required")
});

function getSeededCategories(creatorId: string): Array<{ category: string; duration_hours: number }> {
  const hash = creatorId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const seed = hash % 10000;

  const categoryData: Array<{ category: string; duration_hours: number }> = [];
  for (let i = 0; i < 5; i++) {
    const category = CATEGORIES[i];
    const hours = 10 + ((seed * 89 + i * 211) % 90);
    categoryData.push({ category, duration_hours: hours });
  }

  return categoryData;
}

function computeCategoryMix(categoryData: Array<{ category: string; duration_hours: number }>): CategoryData[] {
  const totalHours = categoryData.reduce((sum, c) => sum + c.duration_hours, 0);

  const result: CategoryData[] = [];
  for (const item of categoryData) {
    const streamCount = 3 + Math.floor(item.duration_hours / 25);
    result.push({
      category: item.category,
      streams: streamCount,
      total_hours: item.duration_hours,
      percent: totalHours > 0 ? Math.round((item.duration_hours / totalHours) * 10000) / 100 : 0
    });
  }

  return result;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const validation = querySchema.safeParse({
    creator_id: searchParams.get("creator_id")
  });

  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { creator_id } = validation.data;
  const categoryData = getSeededCategories(creator_id);
  const categories = computeCategoryMix(categoryData);

  return NextResponse.json({ categories });
}
