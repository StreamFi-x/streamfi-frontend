import { NextResponse } from "next/server";
import { isValidSudokuGrid, validateSudokuGrid } from "./_lib/validator";

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const grid = (body as { grid?: unknown })?.grid;
  if (!isValidSudokuGrid(grid)) {
    return NextResponse.json(
      { error: "Malformed grid. Expected 9x9 grid of numbers 1-9 or null." },
      { status: 400 }
    );
  }

  return NextResponse.json(validateSudokuGrid(grid));
}
