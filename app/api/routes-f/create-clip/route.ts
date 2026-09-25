/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";

export type ClipRecord = {
  clip_id: string;
  stream_id: string;
  playback_id: string;
  duration_seconds: number;
  title: string;
  mux_url_pattern: string;
  created_at: string;
};

export const CREATED_CLIPS: ClipRecord[] = [];

// Simple nanoid-style generator since we cannot import external libraries easily
const generateId = () => {
  return Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { stream_id, playback_id, duration_seconds = 30, title = "Untitled Clip" } = body;

    if (!stream_id || !playback_id) {
      return NextResponse.json({ error: "stream_id and playback_id are required" }, { status: 400 });
    }

    if (typeof duration_seconds !== "number" || duration_seconds < 5 || duration_seconds > 90) {
      return NextResponse.json({ error: "duration_seconds must be between 5 and 90" }, { status: 400 });
    }

    const clip_id = `clip_${generateId()}`;
    const mux_url_pattern = `https://stream.mux.com/${playback_id}.m3u8?end=${Math.floor(Date.now() / 1000)}&duration=${duration_seconds}`;

    const newClip: ClipRecord = {
      clip_id,
      stream_id,
      playback_id,
      duration_seconds,
      title,
      mux_url_pattern,
      created_at: new Date().toISOString(),
    };

    CREATED_CLIPS.push(newClip);

    return NextResponse.json({
      clip_id,
      mux_url_pattern,
    });
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
