/**
 * Tip Goal Manage — issue #978
 *
 * POST   { creator_id, goal_usdc, title?, ends_at? }  -> { goal_id, created_at }
 * PATCH  { creator_id, goal_usdc?, title?, ends_at? }  -> updated TipGoal
 * DELETE ?creator_id                                   -> { success: true }
 */
import { NextRequest, NextResponse } from "next/server";
import { goalStore, generateId, _resetStore } from "./store";
import { TipGoal } from "./types";

export { _resetStore };

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const { creator_id, goal_usdc, title, ends_at } = body as {
    creator_id?: unknown;
    goal_usdc?: unknown;
    title?: unknown;
    ends_at?: unknown;
  };

  if (!creator_id || typeof creator_id !== "string") {
    return badRequest("creator_id is required");
  }
  if (typeof goal_usdc !== "number" || goal_usdc <= 0) {
    return badRequest("goal_usdc must be a positive number");
  }
  if (ends_at !== undefined) {
    if (typeof ends_at !== "string" || new Date(ends_at) <= new Date()) {
      return badRequest("ends_at must be a future ISO date string");
    }
  }

  const now = new Date().toISOString();
  const goal: TipGoal = {
    goal_id: generateId(),
    creator_id,
    goal_usdc,
    ...(title && typeof title === "string" ? { title } : {}),
    ...(ends_at ? { ends_at: ends_at as string } : {}),
    created_at: now,
    updated_at: now,
  };

  goalStore.set(creator_id, goal);
  return NextResponse.json({ goal_id: goal.goal_id, created_at: goal.created_at }, { status: 201 });
}

// ── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const { creator_id, goal_usdc, title, ends_at } = body as {
    creator_id?: unknown;
    goal_usdc?: unknown;
    title?: unknown;
    ends_at?: unknown;
  };

  if (!creator_id || typeof creator_id !== "string") {
    return badRequest("creator_id is required");
  }

  const existing = goalStore.get(creator_id);
  if (!existing) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  if (goal_usdc !== undefined) {
    if (typeof goal_usdc !== "number" || goal_usdc <= 0) {
      return badRequest("goal_usdc must be a positive number");
    }
    existing.goal_usdc = goal_usdc;
  }
  if (title !== undefined) {
    if (typeof title !== "string") return badRequest("title must be a string");
    existing.title = title;
  }
  if (ends_at !== undefined) {
    if (typeof ends_at !== "string" || new Date(ends_at) <= new Date()) {
      return badRequest("ends_at must be a future ISO date string");
    }
    existing.ends_at = ends_at;
  }

  existing.updated_at = new Date().toISOString();
  goalStore.set(creator_id, existing);
  return NextResponse.json(existing, { status: 200 });
}

// ── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const creator_id = new URL(req.url).searchParams.get("creator_id");
  if (!creator_id) return badRequest("creator_id is required");

  if (!goalStore.has(creator_id)) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  goalStore.delete(creator_id);
  return NextResponse.json({ success: true }, { status: 200 });
}
