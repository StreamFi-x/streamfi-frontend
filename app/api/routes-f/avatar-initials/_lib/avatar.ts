/**
 * Avatar-from-initials helpers (#582).
 * All logic scoped to this folder — no external imports.
 */

const DEFAULT_SIZE = 128;
const MIN_SIZE = 32;
const MAX_SIZE = 512;

/** Extract up to 2 initials from a full name. */
export function extractInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** Clamp size to [MIN_SIZE, MAX_SIZE]. */
export function clampSize(raw: unknown): number {
  const n = parseInt(String(raw ?? DEFAULT_SIZE), 10);
  if (isNaN(n)) return DEFAULT_SIZE;
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, n));
}

/** djb2 hash → deterministic hue for a given name. */
function nameToHue(name: string): number {
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) + hash) ^ name.charCodeAt(i);
    hash = hash >>> 0;
  }
  return hash % 360;
}

/** HSL → { r, g, b } (0–255). */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}

/** Relative luminance per WCAG 2.1. */
function luminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Pick white or black foreground based on contrast ratio. */
function foregroundColor(r: number, g: number, b: number): string {
  const l = luminance(r, g, b);
  const whiteCR = (1.05) / (l + 0.05);
  const blackCR = (l + 0.05) / 0.05;
  return whiteCR >= blackCR ? "#ffffff" : "#000000";
}

export interface AvatarParams {
  name: string;
  size: number;
}

export function buildAvatar({ name, size }: AvatarParams): string {
  const initials = extractInitials(name);
  const hue = nameToHue(name);
  const { r, g, b } = hslToRgb(hue, 55, 45);
  const bg = `rgb(${r},${g},${b})`;
  const fg = foregroundColor(r, g, b);
  const fontSize = Math.round(size * 0.4);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${bg}" rx="${Math.round(size * 0.1)}"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
        font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="600" fill="${fg}">${initials}</text>
</svg>`;
}
