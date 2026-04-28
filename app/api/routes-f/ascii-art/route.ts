import { NextRequest, NextResponse } from "next/server";
import { generateAsciiArt } from "./_lib/helpers";
import type { AsciiArtRequest, AsciiArtResponse } from "./_lib/types";

export async function POST(req: NextRequest) {
  let body: AsciiArtRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { text, font = 'standard', width } = body;

  try {
    const art = generateAsciiArt(text, font, width);
    return NextResponse.json({ art, font_used: font } as AsciiArtResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ASCII art generation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
