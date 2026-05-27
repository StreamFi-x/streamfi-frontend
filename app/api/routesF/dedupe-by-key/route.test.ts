import { NextRequest } from "next/server";
import { POST } from "./route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/dedupe-by-key", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Dedupe By Key API", () => {
  it("keeps first occurrence by default", async () => {
    const items = [
      { id: 1, name: "a" },
      { id: 2, name: "b" },
      { id: 1, name: "c" },
    ];
    const res = await POST(makeReq({ items, key: "id" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.items).toEqual([
      { id: 1, name: "a" },
      { id: 2, name: "b" },
    ]);
    expect(data.removed_count).toBe(1);
  });

  it("keeps last occurrence when keep=last", async () => {
    const items = [
      { id: 1, name: "a" },
      { id: 2, name: "b" },
      { id: 1, name: "c" },
    ];
    const res = await POST(makeReq({ items, key: "id", keep: "last" }));
    const data = await res.json();
    expect(data.items).toEqual([
      { id: 2, name: "b" },
      { id: 1, name: "c" },
    ]);
    expect(data.removed_count).toBe(1);
  });

  it("supports dot-path keys", async () => {
    const items = [
      { user: { id: 1 }, name: "a" },
      { user: { id: 2 }, name: "b" },
      { user: { id: 1 }, name: "c" },
    ];
    const res = await POST(makeReq({ items, key: "user.id" }));
    const data = await res.json();
    expect(data.items).toHaveLength(2);
    expect(data.removed_count).toBe(1);
  });

  it("returns 400 for missing items", async () => {
    const res = await POST(makeReq({ key: "id" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing key", async () => {
    const res = await POST(makeReq({ items: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for items exceeding 10000", async () => {
    const items = Array.from({ length: 10001 }, (_, i) => ({ id: i }));
    const res = await POST(makeReq({ items, key: "id" }));
    expect(res.status).toBe(400);
  });

  it("handles empty array", async () => {
    const res = await POST(makeReq({ items: [], key: "id" }));
    const data = await res.json();
    expect(data.items).toEqual([]);
    expect(data.removed_count).toBe(0);
  });
});
