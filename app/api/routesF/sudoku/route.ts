import { NextRequest, NextResponse } from "next/server";

type Grid = number[][];
type PuzzleGrid = (number | null)[][];
type Difficulty = "easy" | "medium" | "hard";

const SIZE = 9;
const BOX = 3;
const REMOVE_COUNT: Record<Difficulty, number> = {
  easy: 36,
  medium: 46,
  hard: 54,
};

function createRng(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

function shuffledRange(rng: () => number, start = 0, end = SIZE): number[] {
  const arr = Array.from({ length: end - start }, (_, i) => i + start);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function isValidPlacement(
  grid: Grid,
  row: number,
  col: number,
  value: number
): boolean {
  for (let i = 0; i < SIZE; i += 1) {
    if (grid[row][i] === value || grid[i][col] === value) {return false;}
  }
  const boxRow = Math.floor(row / BOX) * BOX;
  const boxCol = Math.floor(col / BOX) * BOX;
  for (let r = boxRow; r < boxRow + BOX; r += 1) {
    for (let c = boxCol; c < boxCol + BOX; c += 1) {
      if (grid[r][c] === value) {return false;}
    }
  }
  return true;
}

function findEmpty(grid: Grid): [number, number] | null {
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (grid[r][c] === 0) {return [r, c];}
    }
  }
  return null;
}

function fillGrid(grid: Grid, rng: () => number): boolean {
  const empty = findEmpty(grid);
  if (!empty) {return true;}
  const [row, col] = empty;

  for (const n of shuffledRange(rng, 1, 10)) {
    if (isValidPlacement(grid, row, col, n)) {
      grid[row][col] = n;
      if (fillGrid(grid, rng)) {return true;}
      grid[row][col] = 0;
    }
  }
  return false;
}

function solveCount(grid: Grid, cap = 2): number {
  const empty = findEmpty(grid);
  if (!empty) {return 1;}
  const [row, col] = empty;
  let count = 0;
  for (let n = 1; n <= 9; n += 1) {
    if (!isValidPlacement(grid, row, col, n)) {continue;}
    grid[row][col] = n;
    count += solveCount(grid, cap);
    if (count >= cap) {
      grid[row][col] = 0;
      return count;
    }
    grid[row][col] = 0;
  }
  return count;
}

function removeCellsUnique(
  solution: Grid,
  removeTarget: number,
  rng: () => number
): PuzzleGrid {
  const puzzle = solution.map(row => row.map(n => n as number | null));
  const positions = shuffledRange(rng, 0, SIZE * SIZE);
  let removed = 0;

  for (const pos of positions) {
    if (removed >= removeTarget) {break;}
    const row = Math.floor(pos / SIZE);
    const col = pos % SIZE;
    if (puzzle[row][col] === null) {continue;}

    const backup = puzzle[row][col];
    puzzle[row][col] = null;

    const asGrid: Grid = puzzle.map(r => r.map(v => v ?? 0));
    if (solveCount(asGrid, 2) !== 1) {
      puzzle[row][col] = backup;
    } else {
      removed += 1;
    }
  }

  return puzzle;
}

export function generateSudoku(
  difficulty: Difficulty,
  seed: number
): { puzzle: PuzzleGrid; solution: Grid } {
  const rng = createRng(seed);
  const solution: Grid = Array.from({ length: SIZE }, () =>
    Array(SIZE).fill(0)
  );
  fillGrid(solution, rng);
  const puzzle = removeCellsUnique(solution, REMOVE_COUNT[difficulty], rng);
  return { puzzle, solution };
}

function parseSeed(seedParam: string | null): number {
  if (!seedParam) {return 1;}
  const parsed = Number(seedParam);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 1;
}

export async function GET(req: NextRequest) {
  const difficultyParam =
    req.nextUrl.searchParams.get("difficulty") ?? "medium";
  const seed = parseSeed(req.nextUrl.searchParams.get("seed"));
  if (
    difficultyParam !== "easy" &&
    difficultyParam !== "medium" &&
    difficultyParam !== "hard"
  ) {
    return NextResponse.json(
      { error: "difficulty must be one of easy, medium, hard." },
      { status: 400 }
    );
  }

  const data = generateSudoku(difficultyParam, seed);
  return NextResponse.json(data);
}
