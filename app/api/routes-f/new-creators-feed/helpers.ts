import type { NewCreator } from "./types";

export function now(): Date {
  return new Date();
}
function daysAgo(days: number, ref: Date = new Date()): string {
  const d = new Date(ref);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/**
 * Generates seed creators with join dates relative to "now".
 * Called per-request so tests that mock `now()` get fresh dates.
 */
export function getSeedCreators(): NewCreator[] {
  const ref = now();
  return [
    {
      id: "cr-new-001",
      name: "StellarSam",
      wallet_address: "GBZX...SAM1",
      avatar_url: "https://streamfi.xyz/avatars/stellar-sam.webp",
      category: "DeFi & Finance",
      joined_at: daysAgo(1, ref),
      stream_count: 4,
      followers: 23,
      is_live: true,
    },
    {
      id: "cr-new-002",
      name: "PixelPaula",
      wallet_address: "GCXY...PAU2",
      avatar_url: "https://streamfi.xyz/avatars/pixel-paula.webp",
      category: "Digital Art",
      joined_at: daysAgo(3, ref),
      stream_count: 2,
      followers: 11,
      is_live: false,
    },
    {
      id: "cr-new-003",
      name: "CodeWithKai",
      wallet_address: "GDAB...KAI3",
      avatar_url: "https://streamfi.xyz/avatars/code-with-kai.webp",
      category: "Dev & Programming",
      joined_at: daysAgo(5, ref),
      stream_count: 7,
      followers: 45,
      is_live: true,
    },
    {
      id: "cr-new-004",
      name: "BeatsByNova",
      wallet_address: "GDEF...NOV4",
      avatar_url: "https://streamfi.xyz/avatars/beats-by-nova.webp",
      category: "Music & Production",
      joined_at: daysAgo(6, ref),
      stream_count: 1,
      followers: 8,
      is_live: false,
    },
    {
      id: "cr-new-005",
      name: "CryptoChess",
      wallet_address: "GHIJ...CHE5",
      avatar_url: "https://streamfi.xyz/avatars/crypto-chess.webp",
      category: "Gaming",
      joined_at: daysAgo(10, ref),
      stream_count: 3,
      followers: 19,
      is_live: false,
    },
    {
      id: "cr-new-006",
      name: "ZenYogi",
      wallet_address: "GKLM...ZEN6",
      avatar_url: "https://streamfi.xyz/avatars/zen-yogi.webp",
      category: "Wellness & Lifestyle",
      joined_at: daysAgo(14, ref),
      stream_count: 5,
      followers: 34,
      is_live: true,
    },
    {
      id: "cr-new-007",
      name: "LunarLens",
      wallet_address: "GNOP...LUN7",
      avatar_url: "https://streamfi.xyz/avatars/lunar-lens.webp",
      category: "Photography",
      joined_at: daysAgo(20, ref),
      stream_count: 0,
      followers: 2,
      is_live: false,
    },
    {
      id: "cr-new-008",
      name: "SorobanSally",
      wallet_address: "GQRS...SAL8",
      avatar_url: "https://streamfi.xyz/avatars/soroban-sally.webp",
      category: "DeFi & Finance",
      joined_at: daysAgo(30, ref),
      stream_count: 12,
      followers: 88,
      is_live: false,
    },
  ];
}

// Filtering & sorting

/**
 * Filters seed creators who joined within `withinDays` and have streamed
 * at least `minStreams` times. Results are sorted by `joined_at` descending
 * (most recent first).
 */
export function filterNewCreators(
  creators: NewCreator[],
  withinDays: number,
  minStreams: number
): NewCreator[] {
  const cutoff = new Date(now());
  cutoff.setDate(cutoff.getDate() - withinDays);

  return creators
    .filter(c => {
      const joinedDate = new Date(c.joined_at);
      return joinedDate >= cutoff && c.stream_count >= minStreams;
    })
    .sort(
      (a, b) =>
        new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime()
    );
}
