/**
 * Tests for app/api/routes-f/stinger/
 * Covers: GET library, POST /select, POST /add, library cap
 */

import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { stingerStore, LIBRARY_CAP } from "../store";

function makeGetReq(creator_id: string) {
  return new NextRequest(
    `http://localhost/api/routes-f/stinger?creator_id=${creator_id}`
  );
}

function makePostReq(path: string, body: unknown) {
  return new NextRequest(`http://localhost/api/routes-f/stinger/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  // Reset store state for creator_test
  delete stingerStore["creator_test"];
});

describe("GET /api/routes-f/stinger", () => {
  it("returns 400 when creator_id is missing", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/stinger");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("auto-creates a new creator entry with default stinger", async () => {
    const res = await GET(makeGetReq("creator_test"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.active).toBeNull();
    expect(body.library).toHaveLength(1);
    expect(body.library[0].id).toBe("default");
  });

  it("returns existing library for known creator", async () => {
    const res = await GET(makeGetReq("creator_alice"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.library.length).toBeGreaterThan(1);
    expect(body.active).toBe("default");
  });
});

describe("POST /api/routes-f/stinger (select)", () => {
  it("selects a valid stinger from library", async () => {
    const req = makePostReq("select", {
      creator_id: "creator_alice",
      stinger_id: "flash-blue",
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.active).toBe("flash-blue");
  });

  it("returns 404 when stinger not in library", async () => {
    const req = makePostReq("select", {
      creator_id: "creator_alice",
      stinger_id: "nonexistent-stinger",
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/routes-f/stinger (add)", () => {
  it("adds a new stinger to library", async () => {
    const req = makePostReq("add", {
      creator_id: "creator_test",
      name: "My Custom Stinger",
      url: "https://cdn.example.com/stinger.webm",
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.stinger.name).toBe("My Custom Stinger");
    expect(body.library.length).toBe(2); // default + new one
  });

  it("enforces library cap", async () => {
    stingerStore["creator_capped"] = {
      active: null,
      library: Array.from({ length: LIBRARY_CAP }, (_, i) => ({
        id: `s${i}`,
        name: `Stinger ${i}`,
        url: `https://cdn.example.com/s${i}.webm`,
      })),
    };

    const req = makePostReq("add", {
      creator_id: "creator_capped",
      name: "One Too Many",
      url: "https://cdn.example.com/extra.webm",
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });
});
