import { corpus, ParagraphStyle, styles } from "./corpus";

const MAX_COUNT = 20;

type RequestBody = {
  count?: unknown;
  style?: unknown;
  seed?: unknown;
};

export function createSeededRandom(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function asSeed(value: unknown): number | null {
  if (value === undefined) return Date.now();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
  return null;
}

function randomInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

export function parseRequest(body: RequestBody):
  | { ok: true; count: number; style: ParagraphStyle; rand: () => number }
  | { ok: false; error: string } {
  const count = body.count === undefined ? 1 : body.count;
  if (!Number.isInteger(count) || (count as number) < 1 || (count as number) > MAX_COUNT) {
    return { ok: false, error: `count must be an integer between 1 and ${MAX_COUNT}` };
  }

  const style = body.style === undefined ? "casual" : body.style;
  if (typeof style !== "string" || !styles.includes(style as ParagraphStyle)) {
    return { ok: false, error: "style must be one of: technical, casual, formal, news" };
  }

  const seed = asSeed(body.seed);
  if (seed === null) {
    return { ok: false, error: "seed must be a finite number or non-empty string" };
  }

  return {
    ok: true,
    count: count as number,
    style: style as ParagraphStyle,
    rand: createSeededRandom(seed),
  };
}

export function generateParagraphs(
  count: number,
  style: ParagraphStyle,
  rand: () => number,
): string[] {
  const sentences = corpus[style];
  const paragraphs: string[] = [];

  for (let i = 0; i < count; i++) {
    const sentenceCount = randomInt(rand, 3, 7);
    const selected: string[] = [];
    for (let j = 0; j < sentenceCount; j++) {
      selected.push(sentences[randomInt(rand, 0, sentences.length - 1)]);
    }
    paragraphs.push(selected.join(" "));
  }

  return paragraphs;
}
