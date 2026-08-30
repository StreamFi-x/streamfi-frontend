import { NextResponse } from "next/server";
import { CSS_NAMED_COLORS, ColorGroup } from "./color-data";
import { shuffleDeterministic } from "./random";

type QueryGroup = ColorGroup | "any";

type ColorResponseItem = {
  name: string;
  hex: string;
  rgb: string;
};

function parseCount(value: string | null): number {
  if (!value) {return 5;}
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {return 5;}
  return Math.min(parsed, 50);
}

function parseSeed(value: string | null): number {
  if (!value) {return Date.now();}
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : 0;
}

function parseGroup(value: string | null): QueryGroup | null {
  if (!value) {return "any";}
  if (value === "any" || value === "reds" || value === "blues") {return value;}
  return null;
}

function hexToRgb(hex: string): string {
  const normalizedHex = hex.replace("#", "");
  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);

  return `rgb(${red}, ${green}, ${blue})`;
}

function pickPool(group: QueryGroup) {
  if (group === "any") {return CSS_NAMED_COLORS;}
  return CSS_NAMED_COLORS.filter((color) => color.group === group);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const count = parseCount(searchParams.get("count"));
  const seed = parseSeed(searchParams.get("seed"));
  const group = parseGroup(searchParams.get("group"));

  if (group === null) {
    return NextResponse.json(
      { error: "group must be one of: reds, blues, any" },
      { status: 400 }
    );
  }

  const pool = pickPool(group);
  const shuffled = shuffleDeterministic(pool, seed);
  const selected = shuffled.slice(0, Math.min(count, pool.length));
  const colors: ColorResponseItem[] = selected.map((color) => ({
    name: color.name,
    hex: color.hex,
    rgb: hexToRgb(color.hex),
  }));

  return NextResponse.json({ colors });
}
