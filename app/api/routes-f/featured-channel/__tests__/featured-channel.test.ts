import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import {
  CANDIDATES,
  selectByWeight,
  resetRotation,
  getCurrentRotationId,
} from "../helpers";

const BASE_URL = "http://localhost/api/routes-f/featured-channel";

function makeGet() {
  return new NextRequest(BASE_URL, { method: "GET" });
}

function makePost() {
  return new NextRequest(`${BASE_URL}/next`, { method: "POST" });
}

beforeEach(() => {
  resetRotation();
});

describe("GET /api/routes-f/featured-channel", () => {
  it("returns 200 with featured_creator, rotation_id, rotates_at", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("featured_creator");
    expect(body).toHaveProperty("rotation_id");
    expect(body).toHaveProperty("rotates_at");
  });

  it("featured_creator has expected fields", async () => {
    const res = await GET();
    const { featured_creator } = await res.json();
    expect(featured_creator).toHaveProperty("id");
    expect(featured_creator).toHaveProperty("name");
    expect(featured_creator).toHaveProperty("wallet_address");
    expect(featured_creator).toHaveProperty("avatar_url");
    expect(featured_creator).toHaveProperty("category");
    expect(featured_creator).toHaveProperty("followers");
    expect(typeof featured_creator.is_live).toBe("boolean");
    expect(typeof featured_creator.weight).toBe("number");
  });

  it("returns the same creator for the same rotation_id (determinism)", async () => {
    const res1 = await GET();
    const res2 = await GET();
    const body1 = await res1.json();
    const body2 = await res2.json();
    expect(body1.featured_creator.id).toBe(body2.featured_creator.id);
    expect(body1.rotation_id).toBe(body2.rotation_id);
  });

  it("rotates_at is a valid future ISO date", async () => {
    const res = await GET();
    const { rotates_at } = await res.json();
    const date = new Date(rotates_at);
    expect(date.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("POST /api/routes-f/featured-channel (advance rotation)", () => {
  it("returns 200 with new rotation_id and rotates_at", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("rotation_id");
    expect(body).toHaveProperty("rotates_at");
  });

  it("advances rotation_id on each POST", async () => {
    const r1 = await POST();
    const r2 = await POST();
    const b1 = await r1.json();
    const b2 = await r2.json();
    expect(b1.rotation_id).not.toBe(b2.rotation_id);
  });

  it("GET after POST returns a different rotation_id", async () => {
    const getRes1 = await GET();
    const { rotation_id: rid1 } = await getRes1.json();

    await POST();

    const getRes2 = await GET();
    const { rotation_id: rid2 } = await getRes2.json();
    expect(rid1).not.toBe(rid2);
  });
});

describe("selectByWeight determinism", () => {
  it("same rotation_id always produces the same creator", () => {
    const a = selectByWeight(CANDIDATES, "test-seed-42");
    const b = selectByWeight(CANDIDATES, "test-seed-42");
    expect(a.id).toBe(b.id);
  });

  it("different rotation_ids can produce different creators", () => {
    const ids = Array.from({ length: 50 }, (_, i) => `seed-${i}`);
    const selected = new Set(ids.map(id => selectByWeight(CANDIDATES, id).id));
    // With 50 different seeds and 20 candidates, we expect multiple distinct picks
    expect(selected.size).toBeGreaterThan(1);
  });

  it("higher-weight creators are selected more frequently", () => {
    const counts: Record<string, number> = {};
    const trials = 1000;
    for (let i = 0; i < trials; i++) {
      const c = selectByWeight(CANDIDATES, `distribution-${i}`);
      counts[c.id] = (counts[c.id] || 0) + 1;
    }

    // GamingGuru (weight 15) should appear more often than LunarLens (weight 1)
    const highWeight = counts["fc-003"] ?? 0;
    const lowWeight = counts["fc-012"] ?? 0;
    expect(highWeight).toBeGreaterThan(lowWeight);
  });

  it("all candidates can potentially be selected", () => {
    const selected = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      const c = selectByWeight(CANDIDATES, `coverage-${i}`);
      selected.add(c.id);
    }
    // With 5000 trials, all 20 candidates should appear at least once
    expect(selected.size).toBe(CANDIDATES.length);
  });
});
