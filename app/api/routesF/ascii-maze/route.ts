import { NextRequest, NextResponse } from "next/server";
import { renderMaze } from "./maze";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function parseInteger(value: string | null, fallback: number) {
  if (value === null) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const width = parseInteger(searchParams.get("width"), 10);
  const height = parseInteger(searchParams.get("height"), 10);
  const seed = parseInteger(searchParams.get("seed"), 0);

  if (width === null || height === null || seed === null) {
    return badRequest("width, height, and seed must be integers.");
  }

  if (width <= 0 || height <= 0) {
    return badRequest("width and height must be positive integers.");
  }

  if (width > 50 || height > 50) {
    return badRequest("width and height must not exceed 50.");
  }

  return NextResponse.json({
    maze: renderMaze(width, height, seed),
    width,
    height,
  });
}
