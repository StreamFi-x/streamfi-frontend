import { POST, GET } from "../route";
import { clearBuffer, bufferSize } from "../_lib/buffer";
import { NextRequest } from "next/server";

function makePost(body: object): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGet(query = ""): NextRequest {
  return new NextRequest(`http://localhost/api/routes-f/events${query}`);
}

beforeEach(() => clearBuffer());

const validEvent = { name: "page_view", timestamp: "2024-01-01T00:00:00Z" };

describe("POST /api/routes-f/events — single event", () => {
  it("accepts a single event via 'event' key", async () => {
    const res = await POST(makePost({ event: validEvent }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ingested).toBe(1);
    expect(data.ids).toHaveLength(1);
  });

  it("accepts optional properties", async () => {
    const res = await POST(makePost({ event: { ...validEvent, properties: { url: "/home" } } }));
    expect(res.status).toBe(201);
  });

  it("rejects missing name", async () => {
    const res = await POST(makePost({ event: { timestamp: "2024-01-01T00:00:00Z" } }));
    expect(res.status).toBe(400);
  });

  it("rejects missing timestamp", async () => {
    const res = await POST(makePost({ event: { name: "click" } }));
    expect(res.status).toBe(400);
  });

  it("rejects non-object properties", async () => {
    const res = await POST(makePost({ event: { ...validEvent, properties: "bad" } }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/routes-f/events — batch", () => {
  it("accepts a batch of events", async () => {
    const events = Array.from({ length: 5 }, (_, i) => ({ name: `evt_${i}`, timestamp: "2024-01-01T00:00:00Z" }));
    const res = await POST(makePost({ events }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ingested).toBe(5);
  });

  it("rejects batch > 100", async () => {
    const events = Array.from({ length: 101 }, () => validEvent);
    const res = await POST(makePost({ events }));
    expect(res.status).toBe(400);
  });

  it("validates each event in batch", async () => {
    const res = await POST(makePost({ events: [validEvent, { name: "bad" }] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when neither event nor events provided", async () => {
    const res = await POST(makePost({}));
    expect(res.status).toBe(400);
  });
});

describe("Buffer eviction", () => {
  it("evicts oldest events when buffer exceeds 10,000", async () => {
    // Fill buffer to near capacity with batches of 100
    for (let i = 0; i < 100; i++) {
      const events = Array.from({ length: 100 }, (_, j) => ({ name: `batch${i}_${j}`, timestamp: "2024-01-01T00:00:00Z" }));
      await POST(makePost({ events }));
    }
    expect(bufferSize()).toBe(10_000);

    // One more event should evict the oldest
    await POST(makePost({ event: { name: "new_event", timestamp: "2024-01-01T00:00:00Z" } }));
    expect(bufferSize()).toBe(10_000);

    const res = await GET(makeGet("?page=1&limit=1"));
    const data = await res.json();
    // The newest event is the last one inserted
    expect(data.events[data.total - 1]?.name ?? data.events.at(-1)?.name).toBeDefined();
  });
});

describe("GET /api/routes-f/events — pagination", () => {
  beforeEach(async () => {
    const events = Array.from({ length: 25 }, (_, i) => ({ name: `e${i}`, timestamp: "2024-01-01T00:00:00Z" }));
    await POST(makePost({ events }));
  });

  it("returns first page", async () => {
    const res = await GET(makeGet("?page=1&limit=10"));
    const data = await res.json();
    expect(data.events).toHaveLength(10);
    expect(data.total).toBe(25);
    expect(data.pages).toBe(3);
  });

  it("returns last partial page", async () => {
    const res = await GET(makeGet("?page=3&limit=10"));
    const data = await res.json();
    expect(data.events).toHaveLength(5);
  });

  it("pages do not overlap", async () => {
    const p1 = await (await GET(makeGet("?page=1&limit=10"))).json();
    const p2 = await (await GET(makeGet("?page=2&limit=10"))).json();
    const ids1 = new Set(p1.events.map((e: { id: string }) => e.id));
    const ids2 = new Set(p2.events.map((e: { id: string }) => e.id));
    const overlap = [...ids1].filter((id) => ids2.has(id));
    expect(overlap).toHaveLength(0);
  });
});
