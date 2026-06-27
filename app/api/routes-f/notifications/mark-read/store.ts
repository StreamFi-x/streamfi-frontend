import type { Notification } from "./types";

const SEED: Notification[] = [
  {
    id: "n_001",
    viewer_id: "viewer_001",
    type: "tip_received",
    body: "CryptoKing tipped you 5 XLM during your last stream.",
    link: "/dashboard/tips",
    read: false,
    created_at: "2026-06-26T10:00:00Z",
  },
  {
    id: "n_002",
    viewer_id: "viewer_001",
    type: "new_subscriber",
    body: "stellarfan99 just subscribed to your channel.",
    link: "/dashboard/subscribers",
    read: false,
    created_at: "2026-06-26T09:45:00Z",
  },
  {
    id: "n_003",
    viewer_id: "viewer_001",
    type: "stream_live",
    body: "moonshot_dev went live — 'Building on Stellar'",
    link: "/watch/moonshot_dev",
    read: true,
    created_at: "2026-06-26T09:00:00Z",
  },
  {
    id: "n_004",
    viewer_id: "viewer_001",
    type: "clip_featured",
    body: "Your clip 'Soroban deploy in 60s' was featured on the front page.",
    link: "/clips/n_featured_01",
    read: false,
    created_at: "2026-06-25T22:30:00Z",
  },
  {
    id: "n_005",
    viewer_id: "viewer_002",
    type: "payment_confirmed",
    body: "Your USDC payout of $12.50 was confirmed on-chain.",
    link: "/dashboard/payouts",
    read: false,
    created_at: "2026-06-25T18:00:00Z",
  },
  {
    id: "n_006",
    viewer_id: "viewer_002",
    type: "system",
    body: "Your account was verified successfully.",
    link: "/settings",
    read: false,
    created_at: "2026-06-24T12:00:00Z",
  },
];

let _store: Notification[] = SEED.map((n) => ({ ...n }));

export function getStore(): Notification[] {
  return _store;
}

export function resetStore(): void {
  _store = SEED.map((n) => ({ ...n }));
}
