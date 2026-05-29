import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  text: z.string(),
  keyword: z.string().min(1, "keyword cannot be empty"),
  radius: z.number().min(0).optional().default(50),
  highlight: z.boolean().optional().default(false)
});

interface ExcerptResult {
  excerpt: string;
  match_index: number;
  highlighted?: string;
}

function extractExcerpt(
  text: string, 
  keyword: string, 
  radius: number, 
  highlight: boolean
): ExcerptResult | null {
  // Find first occurrence of keyword (case-insensitive)
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerKeyword);
  
  if (matchIndex === -1) {
    return null;
  }
  
  // Calculate excerpt boundaries
  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(text.length, matchIndex + keyword.length + radius);
  
  // Extract the excerpt
  const excerpt = text.slice(start, end);
  
  const result: ExcerptResult = {
    excerpt,
    match_index: matchIndex
  };
  
  // Add highlighting if requested
  if (highlight) {
    const keywordStart = matchIndex - start;
    const keywordEnd = keywordStart + keyword.length;
    const highlighted = 
      excerpt.slice(0, keywordStart) + 
      `<mark>${excerpt.slice(keywordStart, keywordEnd)}</mark>` + 
      excerpt.slice(keywordEnd);
    
    result.highlighted = highlighted;
  }
  
  return result;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  
  const validation = bodySchema.safeParse(body);
  
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: validation.error.flatten() },
      { status: 400 }
    );
  }
  
  const { text, keyword, radius, highlight } = validation.data;
  
  const result = extractExcerpt(text, keyword, radius, highlight);
  
  if (!result) {
    return NextResponse.json(
      { error: "Keyword not found in text" },
      { status: 404 }
    );
  }
  
  return NextResponse.json(result);
}