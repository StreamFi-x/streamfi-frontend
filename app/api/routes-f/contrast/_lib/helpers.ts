type Rgb = { r: number; g: number; b: number };

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB_PATTERN = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i;

function isRgbChannel(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 255;
}

function expandShortHex(hex: string): string {
  return hex
    .split("")
    .map(char => `${char}${char}`)
    .join("");
}

export function parseColor(input: string): Rgb | null {
  const trimmed = input.trim();

  const hexMatch = trimmed.match(HEX_PATTERN);
  if (hexMatch) {
    const rawHex = hexMatch[1].toLowerCase();
    const fullHex = rawHex.length === 3 ? expandShortHex(rawHex) : rawHex;

    return {
      r: parseInt(fullHex.slice(0, 2), 16),
      g: parseInt(fullHex.slice(2, 4), 16),
      b: parseInt(fullHex.slice(4, 6), 16),
    };
  }

  const rgbMatch = trimmed.match(RGB_PATTERN);
  if (rgbMatch) {
    const r = Number(rgbMatch[1]);
    const g = Number(rgbMatch[2]);
    const b = Number(rgbMatch[3]);

    if (!isRgbChannel(r) || !isRgbChannel(g) || !isRgbChannel(b)) {
      return null;
    }

    return { r, g, b };
  }

  return null;
}

function toLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}
export function relativeLuminance(rgb: Rgb): number {
  return (
    0.2126 * toLinear(rgb.r) +
    0.7152 * toLinear(rgb.g) +
    0.0722 * toLinear(rgb.b)
  );
}

export function contrastRatio(foreground: Rgb, background: Rgb): number {
  const fgLum = relativeLuminance(foreground);
  const bgLum = relativeLuminance(background);
  const lighter = Math.max(fgLum, bgLum);
  const darker = Math.min(fgLum, bgLum);
  return (lighter + 0.05) / (darker + 0.05);
}

export function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function wcagLevels(ratio: number) {
  return {
    aa_normal: ratio >= 4.5,
    aa_large: ratio >= 3,
    aaa_normal: ratio >= 7,
    aaa_large: ratio >= 4.5,
  };
}
