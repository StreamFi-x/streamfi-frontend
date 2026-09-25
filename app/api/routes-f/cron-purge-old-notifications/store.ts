import type { Notification } from "../notifications/mark-read/types";

/**
 * Seed data for this route's own purge target. Deliberately separate from
 * notifications/mark-read/store.ts — that store's rows are all fixed at
 * 2026-06-26, meaning "old" there depends entirely on when this route
 * happens to run, whereas this route needs deterministic old/recent rows
 * to test the 90-day purge boundary. Dates below are anchored to a fixed
 * "now" the tests control via jest.useFakeTimers, not wall-clock time.
 */
const SEED: Notification[] = [
  {
    id: "old_read_1",
    viewer_id: "viewer_001",
    type: "tip_received",
    body: "CryptoKing tipped you 5 XLM.",
    link: "/dashboard/tips",
    read: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "old_read_2",
    viewer_id: "viewer_002",
    type: "system",
    body: "Old system notice.",
    link: "/announcements",
    read: true,
    created_at: "2025-12-15T00:00:00Z",
  },
  {
    id: "old_unread",
    viewer_id: "viewer_001",
    type: "new_subscriber",
    body: "Old but never read.",
    link: "/dashboard/subscribers",
    read: false,
    created_at: "2026-01-02T00:00:00Z",
  },
  {
    id: "recent_read",
    viewer_id: "viewer_001",
    type: "stream_live",
    body: "Recent, already read.",
    link: "/watch/someone",
    read: true,
    created_at: "2026-08-01T00:00:00Z",
  },
  {
    id: "recent_unread",
    viewer_id: "viewer_002",
    type: "payment_confirmed",
    body: "Recent payout.",
    link: "/dashboard/earnings",
    read: false,
    created_at: "2026-08-10T00:00:00Z",
  },
];

let _store: Notification[] = SEED.map((n) => ({ ...n }));

export function getStore(): Notification[] {
  return _store;
}

export function setStore(next: Notification[]): void {
  _store = next;
}

export function resetStore(): void {
  _store = SEED.map((n) => ({ ...n }));
}
