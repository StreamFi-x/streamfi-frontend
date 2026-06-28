/**
 * @jest-environment node
 *
 * Tests for GET/PUT /api/routes-f/channel-weekly-schedule
 *
 * Seed state:
 *   creator_001 — 3 slots (Mon 18:00, Wed 20:00, Sat 15:00)
 *   creator_002 — 1 slot  (Fri 21:00)
 */

import { NextRequest } from "next/server";
import { GET, PUT } from "../channel-weekly-schedule/route";
import { scheduleStore, resetStore } from "../channel-weekly-schedule/store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGet(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/routes-f/channel-weekly-schedule");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

function makePut(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/channel-weekly-schedule", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_SLOT = { day_of_week: 2, start_time: "19:00", duration_minutes: 60, title: "Wed Stream" };

beforeEach(() => resetStore());

// ---------------------------------------------------------------------------
// GET — validation
// ---------------------------------------------------------------------------

describe("GET /api/routes-f/channel-weekly-schedule — validation", () => {
  it("returns 400 when creator_id is missing", async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(400);
  });

  it("returns 400 when creator_id is empty string", async () => {
    const res = await GET(makeGet({ creator_id: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown creator", async () => {
    const res = await GET(makeGet({ creator_id: "creator_unknown" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });
});

// ---------------------------------------------------------------------------
// GET — happy path
// ---------------------------------------------------------------------------

describe("GET /api/routes-f/channel-weekly-schedule — happy path", () => {
  it("returns 200 with schedule for creator_001", async () => {
    const res = await GET(makeGet({ creator_id: "creator_001" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.creator_id).toBe("creator_001");
    expect(Array.isArray(body.schedule)).toBe(true);
    expect(body.schedule).toHaveLength(3);
    expect(typeof body.updated_at).toBe("string");
  });

  it("each slot has required fields", async () => {
    const res = await GET(makeGet({ creator_id: "creator_001" }));
    const { schedule } = await res.json();
    for (const slot of schedule) {
      expect(typeof slot.day_of_week).toBe("number");
      expect(slot.day_of_week).toBeGreaterThanOrEqual(0);
      expect(slot.day_of_week).toBeLessThanOrEqual(6);
      expect(typeof slot.start_time).toBe("string");
      expect(slot.start_time).toMatch(/^\d{2}:\d{2}$/);
      expect(typeof slot.duration_minutes).toBe("number");
    }
  });

  it("returns creator_002 with 1 slot", async () => {
    const res = await GET(makeGet({ creator_id: "creator_002" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.schedule).toHaveLength(1);
    expect(body.schedule[0].day_of_week).toBe(5);
    expect(body.schedule[0].start_time).toBe("21:00");
  });
});

// ---------------------------------------------------------------------------
// PUT — validation
// ---------------------------------------------------------------------------

describe("PUT /api/routes-f/channel-weekly-schedule — validation", () => {
  it("returns 400 when body is missing creator_id", async () => {
    const res = await PUT(makePut({ schedule: [VALID_SLOT] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when schedule is missing", async () => {
    const res = await PUT(makePut({ creator_id: "creator_001" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when day_of_week is -1", async () => {
    const res = await PUT(makePut({ creator_id: "c1", schedule: [{ ...VALID_SLOT, day_of_week: -1 }] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("returns 400 when day_of_week is 7", async () => {
    const res = await PUT(makePut({ creator_id: "c1", schedule: [{ ...VALID_SLOT, day_of_week: 7 }] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when day_of_week is a float", async () => {
    const res = await PUT(makePut({ creator_id: "c1", schedule: [{ ...VALID_SLOT, day_of_week: 2.5 }] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when start_time is not HH:MM", async () => {
    const res = await PUT(makePut({ creator_id: "c1", schedule: [{ ...VALID_SLOT, start_time: "9:00" }] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when start_time has invalid hours (25:00)", async () => {
    const res = await PUT(makePut({ creator_id: "c1", schedule: [{ ...VALID_SLOT, start_time: "25:00" }] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when start_time has invalid minutes (10:61)", async () => {
    const res = await PUT(makePut({ creator_id: "c1", schedule: [{ ...VALID_SLOT, start_time: "10:61" }] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when duration_minutes is below 15", async () => {
    const res = await PUT(makePut({ creator_id: "c1", schedule: [{ ...VALID_SLOT, duration_minutes: 10 }] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when duration_minutes exceeds 720", async () => {
    const res = await PUT(makePut({ creator_id: "c1", schedule: [{ ...VALID_SLOT, duration_minutes: 721 }] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when title is an empty string", async () => {
    const res = await PUT(makePut({ creator_id: "c1", schedule: [{ ...VALID_SLOT, title: "" }] }));
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// PUT — happy path / round-trip
// ---------------------------------------------------------------------------

describe("PUT /api/routes-f/channel-weekly-schedule — happy path", () => {
  it("creates a new schedule for a new creator and round-trips via GET", async () => {
    const slots = [
      { day_of_week: 0, start_time: "12:00", duration_minutes: 90, title: "Sunday Chill" },
      { day_of_week: 4, start_time: "20:30", duration_minutes: 60 },
    ];
    const put = await PUT(makePut({ creator_id: "creator_new", schedule: slots }));
    expect(put.status).toBe(200);
    const putBody = await put.json();
    expect(putBody.creator_id).toBe("creator_new");
    expect(putBody.schedule).toHaveLength(2);
    expect(typeof putBody.updated_at).toBe("string");

    // Verify via GET
    const get = await GET(makeGet({ creator_id: "creator_new" }));
    expect(get.status).toBe(200);
    const getBody = await get.json();
    expect(getBody.schedule).toHaveLength(2);
    expect(getBody.schedule[0].day_of_week).toBe(0);
    expect(getBody.schedule[0].start_time).toBe("12:00");
    expect(getBody.schedule[0].title).toBe("Sunday Chill");
    expect(getBody.schedule[1].day_of_week).toBe(4);
    expect(getBody.schedule[1].title).toBeUndefined();
  });

  it("replaces an existing schedule entirely", async () => {
    // creator_001 starts with 3 slots; replace with 1
    const put = await PUT(makePut({
      creator_id: "creator_001",
      schedule: [{ day_of_week: 2, start_time: "10:00", duration_minutes: 30 }],
    }));
    expect(put.status).toBe(200);

    const get = await GET(makeGet({ creator_id: "creator_001" }));
    const body = await get.json();
    expect(body.schedule).toHaveLength(1);
    expect(body.schedule[0].start_time).toBe("10:00");
  });

  it("accepts an empty schedule (clears all slots)", async () => {
    const put = await PUT(makePut({ creator_id: "creator_001", schedule: [] }));
    expect(put.status).toBe(200);
    const get = await GET(makeGet({ creator_id: "creator_001" }));
    const body = await get.json();
    expect(body.schedule).toHaveLength(0);
  });

  it("updated_at changes after a PUT", async () => {
    const before = scheduleStore.get("creator_001")!.updated_at;
    await PUT(makePut({ creator_id: "creator_001", schedule: [VALID_SLOT] }));
    const get = await GET(makeGet({ creator_id: "creator_001" }));
    const { updated_at } = await get.json();
    expect(updated_at).not.toBe(before);
  });

  it("accepts all valid day_of_week boundary values 0 and 6", async () => {
    const res = await PUT(makePut({
      creator_id: "c_boundary",
      schedule: [
        { day_of_week: 0, start_time: "00:00", duration_minutes: 15 },
        { day_of_week: 6, start_time: "23:59", duration_minutes: 720 },
      ],
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.schedule).toHaveLength(2);
  });

  it("accepts title as optional (slot without title is valid)", async () => {
    const res = await PUT(makePut({
      creator_id: "c_notitle",
      schedule: [{ day_of_week: 1, start_time: "18:00", duration_minutes: 60 }],
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.schedule[0].title).toBeUndefined();
  });

  it("persists slots independently per creator", async () => {
    await PUT(makePut({ creator_id: "creator_a", schedule: [{ day_of_week: 1, start_time: "09:00", duration_minutes: 30 }] }));
    await PUT(makePut({ creator_id: "creator_b", schedule: [{ day_of_week: 3, start_time: "14:00", duration_minutes: 45 }] }));

    const a = await (await GET(makeGet({ creator_id: "creator_a" }))).json();
    const b = await (await GET(makeGet({ creator_id: "creator_b" }))).json();
    expect(a.schedule[0].day_of_week).toBe(1);
    expect(b.schedule[0].day_of_week).toBe(3);
  });
});
