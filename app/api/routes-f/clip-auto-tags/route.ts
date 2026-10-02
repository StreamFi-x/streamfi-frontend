import { NextRequest, NextResponse } from "next/server";
import type { ClipAutoTagsRequest, ClipAutoTagsResponse } from "./types";
import { TAG_KEYWORDS } from "./tag-map";

const MAX_TAGS = 5;

function generateTags(title: string, description?: string): string[] {
  const text = `${title} ${description ?? ""}`.toLowerCase();
  const words = text.split(/\s+/);

  const scores: Record<string, number> = {};

  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (keyword.includes(" ")) {
        if (text.includes(keyword)) {
          score += 2;
        }
      } else {
        for (const word of words) {
          if (word === keyword || word.startsWith(keyword)) {
            score += 1;
          }
        }
      }
    }
    if (score > 0) {
      scores[tag] = score;
    }
  }

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TAGS)
    .map(([tag]) => tag);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: ClipAutoTagsRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { title, description } = body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json(
      { error: "title is required and must be a non-empty string" },
      { status: 400 }
    );
  }

  if (description !== undefined && typeof description !== "string") {
    return NextResponse.json(
      { error: "description must be a string" },
      { status: 400 }
    );
  }

  const tags = generateTags(title.trim(), description?.trim());

  return NextResponse.json({ tags } as ClipAutoTagsResponse);
}
