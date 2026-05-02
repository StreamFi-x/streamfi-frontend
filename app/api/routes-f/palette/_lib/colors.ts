export type PaletteScheme =
  | "complementary"
  | "analogous"
  | "triadic"
  | "monochrome";

type Hsl = {
  h: number;
  s: number;
  l: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeHue(hue: number): number {
  const mod = hue % 360;
  return mod < 0 ? mod + 360 : mod;
}

export function isHexColor(value: string): boolean {
  return /^#[\da-fA-F]{6}$/.test(value);
}

export function hexToRgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h: normalizeHue(h), s, l };
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = normalizeHue(h) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hp >= 0 && hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];

  const m = l - c / 2;
  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  ];
}

function rotateHue(base: Hsl, delta: number): string {
  const [r, g, b] = hslToRgb(base.h + delta, base.s, base.l);
  return rgbToHex(r, g, b);
}

function monochrome(base: Hsl, count: number): string[] {
  if (count === 1) {
    const [r, g, b] = hslToRgb(base.h, base.s, base.l);
    return [rgbToHex(r, g, b)];
  }
  const start = clamp(base.l - 0.3, 0.05, 0.95);
  const end = clamp(base.l + 0.3, 0.05, 0.95);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const l = start + (end - start) * t;
    const [r, g, b] = hslToRgb(base.h, base.s, l);
    out.push(rgbToHex(r, g, b));
  }
  return out;
}

export function generatePalette(seed: string, scheme: PaletteScheme, count: number): string[] {
  const [r, g, b] = hexToRgb(seed);
  const base = rgbToHsl(r, g, b);

  if (scheme === "monochrome") return monochrome(base, count);

  const deltas =
    scheme === "complementary"
      ? [0, 180]
      : scheme === "analogous"
        ? [-30, 0, 30]
        : [0, 120, 240];

  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(rotateHue(base, deltas[i % deltas.length]));
  }
  return out;
}
