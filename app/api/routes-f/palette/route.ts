import { NextRequest, NextResponse } from "next/server";
import { generatePalette, isHexColor, PaletteScheme } from "./_lib/colors";

const DEFAULT_COUNT = 5;
const MAX_COUNT = 12;
const SCHEMES: PaletteScheme[] = [
  "complementary",
  "analogous",
  "triadic",
  "monochrome",
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const seed = searchParams.get("seed");
  const schemeRaw = searchParams.get("scheme") ?? "complementary";
  const countRaw = searchParams.get("count");

  if (!seed || !isHexColor(seed)) {
    return NextResponse.json(
      { error: "seed must be a valid 6-digit hex color like #ff6600" },
      { status: 400 },
    );
  }

  if (!SCHEMES.includes(schemeRaw as PaletteScheme)) {
    return NextResponse.json(
      { error: "scheme must be one of: complementary, analogous, triadic, monochrome" },
      { status: 400 },
    );
  }

  const count = countRaw === null ? DEFAULT_COUNT : Number.parseInt(countRaw, 10);
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    return NextResponse.json(
      { error: `count must be an integer between 1 and ${MAX_COUNT}` },
      { status: 400 },
    );
  }

  return NextResponse.json({
    palette: generatePalette(seed.toLowerCase(), schemeRaw as PaletteScheme, count),
  });
}
