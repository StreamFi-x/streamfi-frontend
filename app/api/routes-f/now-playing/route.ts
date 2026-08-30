import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";

interface Track {
  stream_id: string;
  artist: string;
  title: string;
  album?: string;
  art_url?: string;
  played_at: string;
}

interface StreamState {
  current: Track | null;
  history: Track[];
}

const store = new Map<string, StreamState>();

const postSchema = z.object({
  stream_id: z.string().min(1),
  artist: z.string().min(1),
  title: z.string().min(1),
  album: z.string().optional(),
  art_url: z.string().url().optional(),
});

const getSchema = z.object({
  stream_id: z.string().min(1),
});

const deleteSchema = z.object({
  stream_id: z.string().min(1),
});

function getState(stream_id: string): StreamState {
  if (!store.has(stream_id)) {
    store.set(stream_id, { current: null, history: [] });
  }
  return store.get(stream_id)!;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const result = await validateBody(req, postSchema);
  if (result instanceof NextResponse) {return result;}

  const { stream_id, artist, title, album, art_url } = result.data;
  const state = getState(stream_id);

  if (state.current) {
    state.history.unshift({ ...state.current });
    if (state.history.length > 10) {
      state.history = state.history.slice(0, 10);
    }
  }

  const now = new Date().toISOString();
  state.current = { stream_id, artist, title, album, art_url, played_at: now };

  return NextResponse.json({ updated_at: now });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const result = validateQuery(new URL(req.url).searchParams, getSchema);
  if (result instanceof NextResponse) {return result;}

  const { stream_id } = result.data;
  const state = getState(stream_id);

  return NextResponse.json({
    current: state.current,
    history: state.history,
  });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const result = validateQuery(new URL(req.url).searchParams, deleteSchema);
  if (result instanceof NextResponse) {return result;}

  const { stream_id } = result.data;
  store.delete(stream_id);

  return NextResponse.json({ message: "Now-playing cleared" });
}
