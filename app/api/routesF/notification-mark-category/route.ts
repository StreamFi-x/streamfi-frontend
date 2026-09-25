import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type MarkResult = {
  updated_count: number;
};

type ErrorResult = {
  error: string;
};

const CATEGORIES = ["tip", "follow", "stream_live", "chat_mention", "system"] as const;
type NotificationCategory = (typeof CATEGORIES)[number];

const requestSchema = z.object({
  viewer_id: z.string().min(1, "viewer_id is required"),
  category: z.union([z.enum(CATEGORIES), z.literal("all")]),
});

/**
 * Deterministic seed for how many unread notifications a viewer has in each
 * category, so repeated calls with the same viewer_id are stable.
 */
function seedUnreadCounts(viewerId: string): Record<NotificationCategory, number> {
  const hash = viewerId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const counts = {} as Record<NotificationCategory, number>;

  CATEGORIES.forEach((category, index) => {
    counts[category] = (hash * (index + 3)) % 12;
  });

  return counts;
}

export async function POST(req: NextRequest): Promise<NextResponse<MarkResult | ErrorResult>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = requestSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 },
    );
  }

  const { viewer_id, category } = validation.data;
  const unreadCounts = seedUnreadCounts(viewer_id);

  const updated_count =
    category === "all"
      ? CATEGORIES.reduce((sum, cat) => sum + unreadCounts[cat], 0)
      : unreadCounts[category];

  return NextResponse.json({ updated_count });
}
