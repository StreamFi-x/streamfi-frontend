import { createHash } from "crypto";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")   // strip punctuation → space
    .replace(/\s+/g, " ")       // collapse whitespace
    .trim();
}

export function fingerprint(text: string): { fingerprint: string; normalized: string } {
  const normalized = normalizeText(text);
  const tokens = normalized.split(" ").filter(Boolean);
  // deduplicate then sort so order-independent texts yield the same hash
  const canonical = [...new Set(tokens)].sort().join(" ");
  const hash = createHash("sha256").update(canonical, "utf8").digest("hex");
  return { fingerprint: hash, normalized };
}

export function parseAndFingerprint(input: unknown): { fingerprint: string; normalized: string } {
  if (!isRecord(input)) {
    throw new Error("Request body must be an object.");
  }

  if (typeof input.text !== "string") {
    throw new Error("text must be a string.");
  }

  return fingerprint(input.text);
}
