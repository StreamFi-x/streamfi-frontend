import { NextRequest, NextResponse } from "next/server";
import { detectLanguage, SUPPORTED_LANGUAGES } from "./detectLanguage";

// Seed transcripts (what the platform's transcription step would produce)
export const CLIP_TRANSCRIPTS: Record<string, string> = {
  "clip-en": "Welcome back everyone, today we are speedrunning the new dungeon!",
  "clip-ru": "Всем привет, сегодня мы проходим новое подземелье!",
  "clip-ja": "みなさんこんにちは、今日は新しいダンジョンに挑戦します！",
  "clip-zh": "大家好，今天我们挑战新的地下城！",
  "clip-ar": "مرحبا بالجميع، اليوم سوف نستكشف الزنزانة الجديدة",
};

// Manual overrides: clip_id -> language code
export const MANUAL_LANGUAGES: Record<string, string> = {};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clipId = searchParams.get("clip_id");

  if (!clipId) {
    return NextResponse.json({ error: "clip_id is required" }, { status: 400 });
  }

  if (clipId in MANUAL_LANGUAGES) {
    return NextResponse.json({ language: MANUAL_LANGUAGES[clipId], source: "manual" });
  }

  const transcript = CLIP_TRANSCRIPTS[clipId];
  if (transcript === undefined) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  return NextResponse.json({ language: detectLanguage(transcript), source: "detected" });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { clip_id, language } = body;

    if (!clip_id || typeof clip_id !== "string") {
      return NextResponse.json({ error: "clip_id is required" }, { status: 400 });
    }
    if (!language || typeof language !== "string") {
      return NextResponse.json({ error: "language is required" }, { status: 400 });
    }
    if (!SUPPORTED_LANGUAGES.includes(language)) {
      return NextResponse.json(
        { error: `language must be one of: ${SUPPORTED_LANGUAGES.join(", ")}` },
        { status: 400 }
      );
    }

    MANUAL_LANGUAGES[clip_id] = language;

    return NextResponse.json({ clip_id, language, source: "manual" });
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
