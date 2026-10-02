/**
 * Seed notification data for the notification inbox route.
 * Keyed by viewer_id so different viewers see their own inboxes.
 */

export type NotificationType =
  | "tip_received"
  | "new_subscriber"
  | "stream_live"
  | "clip_featured"
  | "payment_confirmed"
  | "system";

export interface Notification {
  id: string;
  type: NotificationType;
  body: string;
  link: string;
  read: boolean;
  created_at: string;
}

const SEED: Record<string, Notification[]> = {
  viewer_001: [
    {
      id: "n_001",
      type: "tip_received",
      body: "CryptoKing tipped you 5 XLM during your last stream.",
      link: "/dashboard/tips",
      read: false,
      created_at: "2026-06-26T10:00:00Z",
    },
    {
      id: "n_002",
      type: "new_subscriber",
      body: "stellarfan99 just subscribed to your channel.",
      link: "/dashboard/subscribers",
      read: false,
      created_at: "2026-06-26T09:45:00Z",
    },
    {
      id: "n_003",
      type: "stream_live",
      body: "moonshot_dev went live — 'Building on Stellar'",
      link: "/watch/moonshot_dev",
      read: true,
      created_at: "2026-06-26T09:00:00Z",
    },
    {
      id: "n_004",
      type: "clip_featured",
      body: "Your clip 'Soroban deploy in 60s' was featured on the front page.",
      link: "/clips/n_featured_01",
      read: false,
      created_at: "2026-06-25T22:30:00Z",
    },
    {
      id: "n_005",
      type: "payment_confirmed",
      body: "Your USDC payout of $12.50 was confirmed on-chain.",
      link: "/dashboard/earnings",
      read: true,
      created_at: "2026-06-25T18:00:00Z",
    },
    {
      id: "n_006",
      type: "system",
      body: "StreamFi maintenance window scheduled for Jun 28, 02:00 UTC.",
      link: "/announcements",
      read: true,
      created_at: "2026-06-25T12:00:00Z",
    },
    {
      id: "n_007",
      type: "tip_received",
      body: "BlockchainBabs tipped you 2 XLM.",
      link: "/dashboard/tips",
      read: true,
      created_at: "2026-06-24T20:15:00Z",
    },
    {
      id: "n_008",
      type: "new_subscriber",
      body: "defi_dana just subscribed to your channel.",
      link: "/dashboard/subscribers",
      read: true,
      created_at: "2026-06-24T15:00:00Z",
    },
    {
      id: "n_009",
      type: "stream_live",
      body: "stellar_samurai went live — 'XLM price analysis'",
      link: "/watch/stellar_samurai",
      read: true,
      created_at: "2026-06-24T10:30:00Z",
    },
    {
      id: "n_010",
      type: "payment_confirmed",
      body: "Your XLM payout of 120 XLM was confirmed on-chain.",
      link: "/dashboard/earnings",
      read: true,
      created_at: "2026-06-23T08:00:00Z",
    },
    {
      id: "n_011",
      type: "clip_featured",
      body: "Your clip 'Smart contract tips' reached 1,000 views.",
      link: "/clips/n_featured_02",
      read: true,
      created_at: "2026-06-22T14:00:00Z",
    },
    {
      id: "n_012",
      type: "system",
      body: "New feature: Multi-currency tips are now live.",
      link: "/announcements",
      read: true,
      created_at: "2026-06-21T09:00:00Z",
    },
  ],
  viewer_002: [
    {
      id: "n_101",
      type: "stream_live",
      body: "luminary_dev went live — 'Soroban deep dive'",
      link: "/watch/luminary_dev",
      read: false,
      created_at: "2026-06-26T11:00:00Z",
    },
    {
      id: "n_102",
      type: "tip_received",
      body: "AstroStacker tipped you 10 XLM.",
      link: "/dashboard/tips",
      read: false,
      created_at: "2026-06-26T10:20:00Z",
    },
    {
      id: "n_103",
      type: "new_subscriber",
      body: "orbit_kat just subscribed to your channel.",
      link: "/dashboard/subscribers",
      read: true,
      created_at: "2026-06-25T16:00:00Z",
    },
  ],
};

/** Returns seed notifications for a viewer, newest first. Returns [] for unknown viewers. */
export function getSeedNotifications(viewerId: string): Notification[] {
  return (SEED[viewerId] ?? []).slice().sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}
