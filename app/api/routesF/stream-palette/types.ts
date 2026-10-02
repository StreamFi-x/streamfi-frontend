export type PaletteRole = "primary" | "accent" | "background" | "text";

export const PALETTE_ROLES: PaletteRole[] = [
  "primary",
  "accent",
  "background",
  "text",
];

export interface PaletteSwatch {
  role: PaletteRole;
  hex: string;
}

export interface PaletteResponse {
  category: string;
  palette: PaletteSwatch[];
}
