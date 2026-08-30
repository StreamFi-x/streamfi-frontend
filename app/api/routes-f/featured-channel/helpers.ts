import type { FeaturedCreator } from "./types";

// ~20 candidate creators with weights for featured rotation
export const CANDIDATES: FeaturedCreator[] = [
  {
    id: "fc-001",
    name: "CryptoKing",
    wallet_address: "GBZX...CK01",
    avatar_url: "https://streamfi.xyz/avatars/crypto-king.webp",
    category: "DeFi & Finance",
    followers: 14200,
    is_live: true,
    weight: 10,
  },
  {
    id: "fc-002",
    name: "ArtByLena",
    wallet_address: "GCXY...LN02",
    avatar_url: "https://streamfi.xyz/avatars/art-by-lena.webp",
    category: "Digital Art",
    followers: 8300,
    is_live: false,
    weight: 7,
  },
  {
    id: "fc-003",
    name: "GamingGuru",
    wallet_address: "GDAB...GG03",
    avatar_url: "https://streamfi.xyz/avatars/gaming-guru.webp",
    category: "Gaming",
    followers: 32000,
    is_live: true,
    weight: 15,
  },
  {
    id: "fc-004",
    name: "MusicMaven",
    wallet_address: "GDEF...MM04",
    avatar_url: "https://streamfi.xyz/avatars/music-maven.webp",
    category: "Music & Production",
    followers: 5600,
    is_live: false,
    weight: 5,
  },
  {
    id: "fc-005",
    name: "DevDojo",
    wallet_address: "GHIJ...DD05",
    avatar_url: "https://streamfi.xyz/avatars/dev-dojo.webp",
    category: "Dev & Programming",
    followers: 11200,
    is_live: true,
    weight: 9,
  },
  {
    id: "fc-006",
    name: "StellarSam",
    wallet_address: "GKLM...SS06",
    avatar_url: "https://streamfi.xyz/avatars/stellar-sam.webp",
    category: "DeFi & Finance",
    followers: 2300,
    is_live: false,
    weight: 3,
  },
  {
    id: "fc-007",
    name: "PixelPaula",
    wallet_address: "GNOP...PP07",
    avatar_url: "https://streamfi.xyz/avatars/pixel-paula.webp",
    category: "Digital Art",
    followers: 1100,
    is_live: false,
    weight: 2,
  },
  {
    id: "fc-008",
    name: "CodeWithKai",
    wallet_address: "GQRS...CK08",
    avatar_url: "https://streamfi.xyz/avatars/code-with-kai.webp",
    category: "Dev & Programming",
    followers: 4500,
    is_live: true,
    weight: 6,
  },
  {
    id: "fc-009",
    name: "BeatsByNova",
    wallet_address: "GTUV...BN09",
    avatar_url: "https://streamfi.xyz/avatars/beats-by-nova.webp",
    category: "Music & Production",
    followers: 800,
    is_live: false,
    weight: 2,
  },
  {
    id: "fc-010",
    name: "CryptoChess",
    wallet_address: "GWXY...CC10",
    avatar_url: "https://streamfi.xyz/avatars/crypto-chess.webp",
    category: "Gaming",
    followers: 1900,
    is_live: false,
    weight: 3,
  },
  {
    id: "fc-011",
    name: "ZenYogi",
    wallet_address: "GABC...ZY11",
    avatar_url: "https://streamfi.xyz/avatars/zen-yogi.webp",
    category: "Wellness & Lifestyle",
    followers: 3400,
    is_live: true,
    weight: 4,
  },
  {
    id: "fc-012",
    name: "LunarLens",
    wallet_address: "GDEF...LL12",
    avatar_url: "https://streamfi.xyz/avatars/lunar-lens.webp",
    category: "Photography",
    followers: 700,
    is_live: false,
    weight: 1,
  },
  {
    id: "fc-013",
    name: "SorobanSally",
    wallet_address: "GHIJ...SS13",
    avatar_url: "https://streamfi.xyz/avatars/soroban-sally.webp",
    category: "DeFi & Finance",
    followers: 8800,
    is_live: false,
    weight: 8,
  },
  {
    id: "fc-014",
    name: "NeonNinja",
    wallet_address: "GKLM...NN14",
    avatar_url: "https://streamfi.xyz/avatars/neon-ninja.webp",
    category: "Gaming",
    followers: 21000,
    is_live: true,
    weight: 12,
  },
  {
    id: "fc-015",
    name: "ChillBeats",
    wallet_address: "GNOP...CB15",
    avatar_url: "https://streamfi.xyz/avatars/chill-beats.webp",
    category: "Music & Production",
    followers: 6200,
    is_live: false,
    weight: 5,
  },
  {
    id: "fc-016",
    name: "BlockBrush",
    wallet_address: "GQRS...BB16",
    avatar_url: "https://streamfi.xyz/avatars/block-brush.webp",
    category: "Digital Art",
    followers: 4100,
    is_live: false,
    weight: 4,
  },
  {
    id: "fc-017",
    name: "QuantumQoder",
    wallet_address: "GTUV...QQ17",
    avatar_url: "https://streamfi.xyz/avatars/quantum-qoder.webp",
    category: "Dev & Programming",
    followers: 15800,
    is_live: true,
    weight: 11,
  },
  {
    id: "fc-018",
    name: "VoxelViv",
    wallet_address: "GWXY...VV18",
    avatar_url: "https://streamfi.xyz/avatars/voxel-viv.webp",
    category: "Gaming",
    followers: 9400,
    is_live: false,
    weight: 7,
  },
  {
    id: "fc-019",
    name: "TokenTara",
    wallet_address: "GABC...TT19",
    avatar_url: "https://streamfi.xyz/avatars/token-tara.webp",
    category: "DeFi & Finance",
    followers: 12600,
    is_live: true,
    weight: 9,
  },
  {
    id: "fc-020",
    name: "RhythmRex",
    wallet_address: "GDEF...RR20",
    avatar_url: "https://streamfi.xyz/avatars/rhythm-rex.webp",
    category: "Music & Production",
    followers: 3200,
    is_live: false,
    weight: 3,
  },
];

// Deterministic seeded PRNG (mulberry32)
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Convert a rotation_id string to a numeric seed
function rotationSeed(rotationId: string): number {
  let hash = 0;
  for (let i = 0; i < rotationId.length; i++) {
    hash = ((hash << 5) - hash + rotationId.charCodeAt(i)) | 0;
  }
  return hash;
}

// Pick a creator using weighted random selection, deterministic by rotation_id
export function selectByWeight(
  candidates: FeaturedCreator[],
  rotationId: string
): FeaturedCreator {
  const rng = mulberry32(rotationSeed(rotationId));
  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  const roll = rng() * totalWeight;

  let cumulative = 0;
  for (const c of candidates) {
    cumulative += c.weight;
    if (roll < cumulative) {return c;}
  }
  return candidates[candidates.length - 1];
}

// In-memory rotation state
let currentRotationIndex = 0;

export function getCurrentRotationId(): string {
  return `rot-${currentRotationIndex}`;
}

export function advanceRotation(): string {
  currentRotationIndex++;
  return getCurrentRotationId();
}

export function resetRotation(): void {
  currentRotationIndex = 0;
}

const ROTATION_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export function getRotatesAt(): string {
  return new Date(Date.now() + ROTATION_INTERVAL_MS).toISOString();
}
