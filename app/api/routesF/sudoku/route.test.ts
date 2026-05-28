import { NextRequest } from "next/server";
import { GET, generateSudoku } from "./route";

function isValidUnit(nums: number[]): boolean {
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted.join(",") === "1,2,3,4,5,6,7,8,9";
}

function isValidSolution(grid: number[][]): boolean {
  for (let r = 0; r < 9; r += 1) {
    if (!isValidUnit(grid[r])) {return false;}
  }
  for (let c = 0; c < 9; c += 1) {
    const col = Array.from({ length: 9 }, (_, r) => grid[r][c]);
    if (!isValidUnit(col)) {return false;}
  }
  for (let br = 0; br < 9; br += 3) {
    for (let bc = 0; bc < 9; bc += 3) {
      const box: number[] = [];
      for (let r = br; r < br + 3; r += 1) {
        for (let c = bc; c < bc + 3; c += 1) {
          box.push(grid[r][c]);
        }
      }
      if (!isValidUnit(box)) {return false;}
    }
  }
  return true;
}

function countSolutions(grid: number[][]): number {
  function canPlace(
    g: number[][],
    row: number,
    col: number,
    val: number
  ): boolean {
    for (let i = 0; i < 9; i += 1) {
      if (g[row][i] === val || g[i][col] === val) {return false;}
    }
    const br = Math.floor(row / 3) * 3;
    const bc = Math.floor(col / 3) * 3;
    for (let r = br; r < br + 3; r += 1) {
      for (let c = bc; c < bc + 3; c += 1) {
        if (g[r][c] === val) {return false;}
      }
    }
    return true;
  }

  function dfs(g: number[][]): number {
    for (let r = 0; r < 9; r += 1) {
      for (let c = 0; c < 9; c += 1) {
        if (g[r][c] === 0) {
          let cnt = 0;
          for (let v = 1; v <= 9; v += 1) {
            if (!canPlace(g, r, c, v)) {continue;}
            g[r][c] = v;
            cnt += dfs(g);
            if (cnt >= 2) {
              g[r][c] = 0;
              return cnt;
            }
            g[r][c] = 0;
          }
          return cnt;
        }
      }
    }
    return 1;
  }

  return dfs(grid.map(row => [...row]));
}

describe("generateSudoku", () => {
  it("is deterministic for same seed + difficulty", () => {
    const a = generateSudoku("medium", 42);
    const b = generateSudoku("medium", 42);
    expect(a).toEqual(b);
  });

  it("returns a valid solved grid", () => {
    const data = generateSudoku("easy", 5);
    expect(isValidSolution(data.solution)).toBe(true);
  });

  it("puzzle aligns with solution", () => {
    const data = generateSudoku("hard", 9);
    for (let r = 0; r < 9; r += 1) {
      for (let c = 0; c < 9; c += 1) {
        if (data.puzzle[r][c] !== null) {
          expect(data.puzzle[r][c]).toBe(data.solution[r][c]);
        }
      }
    }
  });

  it("generated puzzle has unique solution", () => {
    const data = generateSudoku("medium", 42);
    const grid = data.puzzle.map(r => r.map(v => v ?? 0));
    expect(countSolutions(grid)).toBe(1);
  });
});

describe("GET /api/routesF/sudoku", () => {
  it("returns puzzle + solution", async () => {
    const req = new NextRequest(
      "http://localhost/api/routesF/sudoku?difficulty=easy&seed=42"
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.puzzle).toHaveLength(9);
    expect(body.solution).toHaveLength(9);
  });

  it("rejects invalid difficulty", async () => {
    const req = new NextRequest(
      "http://localhost/api/routesF/sudoku?difficulty=expert"
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
