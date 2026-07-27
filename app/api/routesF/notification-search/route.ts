import { NextRequest, NextResponse } from "next/server";

type SeedNotification = {
  id: string;
  viewer_id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
};

const SEED_INBOX: SeedNotification[] = [
  { id: "notif-001", viewer_id: "viewer-a", title: "New follower", body: "creator_alpha started following you", read: false, created_at: "2025-05-01T10:00:00Z" },
  { id: "notif-002", viewer_id: "viewer-a", title: "Tip received", body: "You received 5 XLM tip from viewer-b", read: true, created_at: "2025-05-02T11:00:00Z" },
  { id: "notif-003", viewer_id: "viewer-a", title: "Stream started", body: "creator_alpha is live now!", read: false, created_at: "2025-05-03T12:00:00Z" },
  { id: "notif-004", viewer_id: "viewer-a", title: "Mention", body: "@viewer-a was mentioned in chat", read: false, created_at: "2025-05-04T09:30:00Z" },
  { id: "notif-005", viewer_id: "viewer-a", title: "Subscription renewed", body: "Your subscription to creator_beta renewed successfully", read: true, created_at: "2025-05-05T08:00:00Z" },
  { id: "notif-006", viewer_id: "viewer-b", title: "New follower", body: "creator_gamma started following you", read: false, created_at: "2025-05-01T07:00:00Z" },
  { id: "notif-007", viewer_id: "viewer-b", title: "Payout processed", body: "Your XLM payout of 50 USDC was processed", read: true, created_at: "2025-05-06T13:00:00Z" },
];

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const viewerId = searchParams.get("viewer_id");
  const query = searchParams.get("q");

  if (!viewerId || !viewerId.trim()) {
    return NextResponse.json({ error: "viewer_id is required" }, { status: 400 });
  }

  const rawLimit = searchParams.get("limit");
  let limit = DEFAULT_LIMIT;
  if (rawLimit !== null) {
    const parsed = parseInt(rawLimit, 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
      return NextResponse.json(
        { error: `limit must be an integer between 1 and ${MAX_LIMIT}` },
        { status: 400 },
      );
    }
    limit = parsed;
  }

  let notifications = SEED_INBOX.filter((n) => n.viewer_id === viewerId.trim());

  if (query && query.trim()) {
    const lc = query.trim().toLowerCase();
    notifications = notifications.filter(
      (n) =>
        n.title.toLowerCase().includes(lc) || n.body.toLowerCase().includes(lc),
    );
  }

  return NextResponse.json({
    viewer_id: viewerId.trim(),
    query: query ?? null,
    results: notifications.slice(0, limit),
    count: Math.min(notifications.length, limit),
  });
}
