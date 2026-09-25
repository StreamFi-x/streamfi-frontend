import { PaletteSwatch } from "./types";

/**
 * Overlay palettes per stream category, bundled in-folder.
 * Every palette carries all four roles so overlays can bind them blindly.
 */
export const CATEGORY_PALETTES: Record<string, PaletteSwatch[]> = {
  family: [
    { role: "primary", hex: "#3B82F6" },
    { role: "accent", hex: "#FBBF24" },
    { role: "background", hex: "#F8FAFC" },
    { role: "text", hex: "#0F172A" },
  ],
  gaming: [
    { role: "primary", hex: "#7C3AED" },
    { role: "accent", hex: "#22D3EE" },
    { role: "background", hex: "#0B0B15" },
    { role: "text", hex: "#F5F3FF" },
  ],
  esports: [
    { role: "primary", hex: "#EF4444" },
    { role: "accent", hex: "#FACC15" },
    { role: "background", hex: "#111827" },
    { role: "text", hex: "#F9FAFB" },
  ],
  music: [
    { role: "primary", hex: "#EC4899" },
    { role: "accent", hex: "#A855F7" },
    { role: "background", hex: "#1A0B1F" },
    { role: "text", hex: "#FDF4FF" },
  ],
  irl: [
    { role: "primary", hex: "#F97316" },
    { role: "accent", hex: "#14B8A6" },
    { role: "background", hex: "#1C1917" },
    { role: "text", hex: "#FAFAF9" },
  ],
  crypto: [
    { role: "primary", hex: "#0EA5E9" },
    { role: "accent", hex: "#34D399" },
    { role: "background", hex: "#07131F" },
    { role: "text", hex: "#E0F2FE" },
  ],
  education: [
    { role: "primary", hex: "#2563EB" },
    { role: "accent", hex: "#F59E0B" },
    { role: "background", hex: "#0F172A" },
    { role: "text", hex: "#E2E8F0" },
  ],
  art: [
    { role: "primary", hex: "#D946EF" },
    { role: "accent", hex: "#FB7185" },
    { role: "background", hex: "#171021" },
    { role: "text", hex: "#FAE8FF" },
  ],
  tech: [
    { role: "primary", hex: "#10B981" },
    { role: "accent", hex: "#38BDF8" },
    { role: "background", hex: "#0A0F0D" },
    { role: "text", hex: "#ECFDF5" },
  ],
  mature: [
    { role: "primary", hex: "#991B1B" },
    { role: "accent", hex: "#F87171" },
    { role: "background", hex: "#120404" },
    { role: "text", hex: "#FEE2E2" },
  ],
};

export const PALETTE_CATEGORIES = Object.keys(CATEGORY_PALETTES);

export function normalizeCategory(category: string): string {
  return category.trim().toLowerCase();
}

export function paletteForCategory(category: string): PaletteSwatch[] | null {
  return CATEGORY_PALETTES[normalizeCategory(category)] ?? null;
}
