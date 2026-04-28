import { NextRequest } from "next/server";
import { POST } from "../route";

function makeRequest(grid: (number | null)[][]) {
  return new NextRequest("http://localhost/api/routes-f/sudoku", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grid }),
  });
}

describe("POST /api/routes-f/sudoku", () => {
  it("valid complete", async () => {
    const grid = [
      [5, 3, 4, 6, 7, 8, 9, 1, 2],
      [6, 7, 2, 1, 9, 5, 3, 4, 8],
      [1, 9, 8, 3, 4, 2, 5, 6, 7],
      [8, 5, 9, 7, 6, 1, 4, 2, 3],
      [4, 2, 6, 8, 5, 3, 7, 9, 1],
      [7, 1, 3, 9, 2, 4, 8, 5, 6],
      [9, 6, 1, 5, 3, 7, 2, 8, 4],
      [2, 8, 7, 4, 1, 9, 6, 3, 5],
      [3, 4, 5, 2, 8, 6, 1, 7, 9],
    ];

    const res = await POST(makeRequest(grid));
    const body = await res.json();
    expect(body).toEqual({ valid: true, complete: true, conflicts: [] });
  });

  it("valid partial", async () => {
    const grid = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => null));
    grid[0][0] = 1;
    const res = await POST(makeRequest(grid));
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.complete).toBe(false);
  });

  it("row conflict", async () => {
    const grid = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => null));
    grid[0][0] = 3;
    grid[0][5] = 3;
    const res = await POST(makeRequest(grid));
    const body = await res.json();
    expect(body.conflicts.some((c: any) => c.conflict_type === "row")).toBe(true);
  });

  it("column conflict", async () => {
    const grid = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => null));
    grid[0][0] = 3;
    grid[5][0] = 3;
    const res = await POST(makeRequest(grid));
    const body = await res.json();
    expect(body.conflicts.some((c: any) => c.conflict_type === "column")).toBe(true);
  });

  it("box conflict", async () => {
    const grid = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => null));
    grid[0][0] = 3;
    grid[2][1] = 3;
    const res = await POST(makeRequest(grid));
    const body = await res.json();
    expect(body.conflicts.some((c: any) => c.conflict_type === "box")).toBe(true);
  });
});
