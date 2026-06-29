import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";
import { getStore, Poll } from "./_lib/store";

const createSchema = z.object({
  stream_id: z.string().min(1),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(6),
  duration_seconds: z.number().int().positive(),
});

const getSchema = z.object({
  poll_id: z.string().min(1),
});

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `poll_${ts}_${rand}`;
}

function isExpired(ends_at: string): boolean {
  return new Date() >= new Date(ends_at);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const result = await validateBody(req, createSchema);
  if (result instanceof NextResponse) return result;

  const { stream_id, question, options, duration_seconds } = result.data;

  const id = generateId();
  const now = new Date();
  const ends_at = new Date(now.getTime() + duration_seconds * 1000);

  const poll: Poll = {
    id,
    stream_id,
    question,
    options: options.map((text) => ({ text, votes: 0 })),
    duration_seconds,
    created_at: now.toISOString(),
    ends_at: ends_at.toISOString(),
    voters: new Set(),
  };

  getStore().set(id, poll);

  return NextResponse.json({ poll_id: id, ends_at: poll.ends_at });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const result = validateQuery(new URL(req.url).searchParams, getSchema);
  if (result instanceof NextResponse) return result;

  const { poll_id } = result.data;
  const poll = getStore().get(poll_id);

  if (!poll) {
    return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  }

  const total_votes = poll.options.reduce((sum, o) => sum + o.votes, 0);

  return NextResponse.json({
    question: poll.question,
    options: poll.options.map((o) => ({ text: o.text, votes: o.votes })),
    total_votes,
    ended: isExpired(poll.ends_at),
  });
}
