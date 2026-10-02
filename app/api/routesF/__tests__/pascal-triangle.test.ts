/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../pascal-triangle/route";

function makeReq(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/routesF/pascal-triangle");
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  
  return new NextRequest(url.toString(), { method: "GET" });
}

describe("/api/routesF/pascal-triangle", () => {
  it("generates default 5 rows of Pascal's triangle", async () => {
    const res = await GET(makeReq());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.triangle).toHaveLength(5);
    expect(data.rows).toBe(5);
    
    // Verify the structure of first 5 rows
    expect(data.triangle[0]).toEqual([1]);
    expect(data.triangle[1]).toEqual([1, 1]);
    expect(data.triangle[2]).toEqual([1, 2, 1]);
    expect(data.triangle[3]).toEqual([1, 3, 3, 1]);
    expect(data.triangle[4]).toEqual([1, 4, 6, 4, 1]);
  });

  it("generates single row", async () => {
    const res = await GET(makeReq({ rows: "1" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.triangle).toEqual([[1]]);
    expect(data.rows).toBe(1);
  });

  it("generates 10 rows correctly", async () => {
    const res = await GET(makeReq({ rows: "10" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.triangle).toHaveLength(10);
    
    // Verify row 9 (10th row, 0-indexed)
    expect(data.triangle[9]).toEqual([1, 9, 36, 84, 126, 126, 84, 36, 9, 1]);
  });

  it("verifies row sums are powers of 2", async () => {
    const res = await GET(makeReq({ rows: "8" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    
    data.triangle.forEach((row: number[], index: number) => {
      const sum = row.reduce((acc, val) => acc + val, 0);
      expect(sum).toBe(Math.pow(2, index));
    });
  });

  it("verifies symmetry of rows", async () => {
    const res = await GET(makeReq({ rows: "7" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    
    data.triangle.forEach((row: number[]) => {
      const reversed = [...row].reverse();
      expect(row).toEqual(reversed);
    });
  });

  it("handles large row counts with BigInt", async () => {
    const res = await GET(makeReq({ rows: "20" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.triangle).toHaveLength(20);
    
    // Row 19 should have large numbers but still be accurate
    const row19 = data.triangle[19];
    expect(row19[0]).toBe(1);
    expect(row19[1]).toBe(19);
    expect(row19[10]).toBe(92378); // C(19,10)
  });

  it("rejects rows less than 1", async () => {
    const res = await GET(makeReq({ rows: "0" }));

    expect(res.status).toBe(400);
  });

  it("rejects rows greater than 50", async () => {
    const res = await GET(makeReq({ rows: "51" }));

    expect(res.status).toBe(400);
  });

  it("rejects invalid row parameter", async () => {
    const res = await GET(makeReq({ rows: "invalid" }));

    expect(res.status).toBe(400);
  });

  it("verifies binomial coefficient properties", async () => {
    const res = await GET(makeReq({ rows: "6" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    
    // Row 5 (6th row): [1, 5, 10, 10, 5, 1]
    const row5 = data.triangle[5];
    expect(row5).toEqual([1, 5, 10, 10, 5, 1]);
    
    // Verify C(5,2) = C(5,3) = 10 (symmetry)
    expect(row5[2]).toBe(row5[3]);
    expect(row5[2]).toBe(10);
  });
});