export type FlipResult = {
  flips: Array<"H" | "T">;
  heads_count: number;
  tails_count: number;
  longest_streak: {
    side: "H" | "T";
    length: number;
    start_index: number;
  };
};

function createRandomGenerator(seed?: number): () => number {
  let state = seed === undefined || Number.isNaN(Number(seed)) ? Math.floor(Math.random() * 0xffffffff) : Number(seed) >>> 0;
  if (state === 0) {
    state = 1;
  }

  return () => {
    state ^= (state << 13) >>> 0;
    state ^= state >>> 17;
    state ^= (state << 5) >>> 0;
    return ((state >>> 0) % 0x100000000) / 0x100000000;
  };
}

export function coinFlip(count: number, bias: number, seed?: number): FlipResult {
  const random = createRandomGenerator(seed);
  const flips: Array<"H" | "T"> = [];
  let heads_count = 0;
  let tails_count = 0;

  for (let i = 0; i < count; i += 1) {
    const flip = random() < bias ? "H" : "T";
    flips.push(flip);
    if (flip === "H") {
      heads_count += 1;
    } else {
      tails_count += 1;
    }
  }

  let longest_streak = { side: flips[0] ?? "H", length: flips.length > 0 ? 1 : 0, start_index: 0 };
  let current_side: "H" | "T" | null = null;
  let current_length = 0;
  let current_start = 0;

  for (let i = 0; i < flips.length; i += 1) {
    const flip = flips[i];
    if (flip === current_side) {
      current_length += 1;
    } else {
      current_side = flip;
      current_length = 1;
      current_start = i;
    }

    if (current_length > longest_streak.length) {
      longest_streak = { side: current_side, length: current_length, start_index: current_start };
    }
  }

  return {
    flips,
    heads_count,
    tails_count,
    longest_streak,
  };
}
