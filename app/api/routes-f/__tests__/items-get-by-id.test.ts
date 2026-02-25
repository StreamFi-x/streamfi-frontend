/**
 * Routes-F item GET by id endpoint tests.
 */
jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json", ...init?.headers },
      }),
  },
}));

import { GET } from "../items/[id]/route";
import {
  __test__setRoutesFRecords,
  getRoutesFRecords,
} from "@/lib/routes-f/store";

const makeRequest = () => new Request("http://localhost/api/routes-f/items/rf-1");

const makeContext = (id: string) => ({
  params: { id },
});

const initialRecords = getRoutesFRecords();

describe("GET /api/routes-f/items/[id]", () => {
  beforeEach(() => {
    __test__setRoutesFRecords([
      {
        id: "rf-1",
        title: "Test Record",
        description: "Initial",
        tags: ["test"],
        createdAt: "2026-02-22T00:00:00.000Z",
        updatedAt: "2026-02-22T00:00:00.000Z",
        etag: '"2026-02-22T00:00:00.000Z"',
      },
    ]);
  });

  afterAll(() => {
    __test__setRoutesFRecords(initialRecords);
  });

  it("returns item with ETag for valid id", async () => {
    const res = await GET(makeRequest(), makeContext("rf-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe("rf-1");
    expect(res.headers.get("ETag")).toBe('"2026-02-22T00:00:00.000Z"');
  });

  it("returns 400 for invalid id format", async () => {
    const res = await GET(makeRequest(), makeContext("bad-id"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toMatch(/invalid id format/i);
  });

  it("returns 404 when id is missing", async () => {
    const res = await GET(makeRequest(), makeContext(""));
    expect(res.status).toBe(404);
  });

  it("returns 404 when item is not found", async () => {
    const res = await GET(makeRequest(), makeContext("rf-999"));
    expect(res.status).toBe(404);
  });
});
