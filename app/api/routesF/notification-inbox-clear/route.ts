import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type ClearResult = {
  cleared: boolean;
  notification_count: number;
  undo_available_until: string;
};

type UndoResult = {
  restored: boolean;
  notification_count: number;
};

type ErrorResult = {
  error: string;
};

const UNDO_WINDOW_MS = 60_000;

const clearEntries = new Map<string, { cleared_at: number; notification_count: number }>();

const clearSchema = z.object({
  user_id: z.string().min(1, "user_id is required"),
  action: z.enum(["clear", "undo"]).default("clear"),
});

function seededNotificationCount(userId: string): number {
  const hash = userId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return 5 + (hash % 46);
}

export async function POST(req: NextRequest): Promise<NextResponse<ClearResult | UndoResult | ErrorResult>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = clearSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: validation.error.flatten() } as unknown as ErrorResult,
      { status: 400 }
    );
  }

  const { user_id, action } = validation.data;

  if (action === "undo") {
    const entry = clearEntries.get(user_id);
    if (!entry) {
      return NextResponse.json({ error: "No cleared inbox to undo" }, { status: 404 });
    }
    const elapsed = Date.now() - entry.cleared_at;
    if (elapsed > UNDO_WINDOW_MS) {
      clearEntries.delete(user_id);
      return NextResponse.json({ error: "Undo window has expired" }, { status: 409 });
    }
    const count = entry.notification_count;
    clearEntries.delete(user_id);
    return NextResponse.json({ restored: true, notification_count: count });
  }

  const notification_count = seededNotificationCount(user_id);
  const cleared_at = Date.now();
  clearEntries.set(user_id, { cleared_at, notification_count });

  const undo_available_until = new Date(cleared_at + UNDO_WINDOW_MS).toISOString();
  return NextResponse.json({ cleared: true, notification_count, undo_available_until });
}
