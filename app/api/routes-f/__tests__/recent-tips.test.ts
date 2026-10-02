/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../tips/recent/route";

function makeReq(query: string) {
  return new NextRequest(`http://localhost/api/routes-f/tips/recent?${query}`);
}

describe("Recent Tips Feed API", () => {
  it("should fail if creator_id is missing", async () => {
    const req = makeReq("");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("creator_id is required");
  });

  it("should return newest tips first with default limit of 20", async () => {
    const req = makeReq("creator_id=creator-123");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(Array.isArray(data.tips)).toBe(true);
    expect(data.tips.length).toBe(20);

    // Verify ordering is newest first
    for (let i = 0; i < data.tips.length - 1; i++) {
      const currentTs = new Date(data.tips[i].ts).getTime();
      const nextTs = new Date(data.tips[i + 1].ts).getTime();
      expect(currentTs).toBeGreaterThan(nextTs);
    }

    expect(data.next_cursor).toBe("20");
  });

  it("should respect limit parameter", async () => {
    const req = makeReq("creator_id=creator-123&limit=5");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tips.length).toBe(5);
    expect(data.next_cursor).toBe("5");
  });

  it("should correctly paginate using cursor", async () => {
    // Page 1
    const req1 = makeReq("creator_id=creator-123&limit=15");
    const res1 = await GET(req1);
    const data1 = await res1.json();
    expect(data1.tips.length).toBe(15);
    const cursor = data1.next_cursor;
    expect(cursor).toBe("15");

    // Page 2
    const req2 = makeReq(`creator_id=creator-123&limit=15&cursor=${cursor}`);
    const res2 = await GET(req2);
    const data2 = await res2.json();
    expect(data2.tips.length).toBe(15);
    expect(data2.next_cursor).toBeNull();

    // Verify all returned tips are distinct
    const allHashes = new Set([
      ...data1.tips.map((t: any) => t.tx_hash),
      ...data2.tips.map((t: any) => t.tx_hash),
    ]);
    expect(allHashes.size).toBe(30);
  });
});
