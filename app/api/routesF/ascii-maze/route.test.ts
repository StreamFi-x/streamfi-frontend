import { NextRequest } from "next/server";
import { GET } from "./route";

function makeReq(query = "") {
  return new NextRequest(`http://localhost/api/routesF/ascii-maze${query}`);
}

describe("/api/routesF/ascii-maze", () => {
  it("returns a deterministic maze for a given seed", async () => {
    const resA = await GET(makeReq("?width=4&height=3&seed=42"));
    const resB = await GET(makeReq("?width=4&height=3&seed=42"));
    const dataA = await resA.json();
    const dataB = await resB.json();

    expect(resA.status).toBe(200);
    expect(dataA).toEqual(dataB);
  });

  it("renders the expected ASCII dimensions", async () => {
    const res = await GET(makeReq("?width=4&height=3&seed=42"));
    const data = await res.json();
    const rows = data.maze.split("\n");

    expect(rows).toHaveLength(3 * 2 + 1);
    expect(rows.every((row: string) => row.length === 4 * 2 + 1)).toBe(true);
  });

  it("has a single entrance and exit", async () => {
    const res = await GET(makeReq("?width=4&height=3&seed=42"));
    const data = await res.json();
    const rows = data.maze.split("\n");
    const topOpenings = rows[0]
      .split("")
      .filter((cell: string) => cell === " ").length;
    const bottomOpenings = rows[rows.length - 1]
      .split("")
      .filter((cell: string) => cell === " ").length;

    expect(topOpenings).toBe(1);
    expect(bottomOpenings).toBe(1);
    expect(rows[0][1]).toBe(" ");
    expect(rows[rows.length - 1][rows[0].length - 2]).toBe(" ");
  });

  it("rejects invalid dimensions", async () => {
    const res = await GET(makeReq("?width=0&height=3&seed=42"));

    expect(res.status).toBe(400);
  });
});
