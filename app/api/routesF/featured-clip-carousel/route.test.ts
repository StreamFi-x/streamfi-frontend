import { GET } from "./route";
import { resetCarouselRotation, computeRotationId, selectClipsForRotation, ROTATION_SIZE } from "./route";

describe("GET /api/routesF/featured-clip-carousel", () => {
  beforeEach(() => {
    resetCarouselRotation();
  });

  it("returns clips, rotation_id, and rotates_at", async () => {
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(data.clips)).toBe(true);
    expect(data.clips).toHaveLength(ROTATION_SIZE);
    expect(typeof data.rotation_id).toBe("number");
    expect(typeof data.rotates_at).toBe("string");
  });

  it("is deterministic within the same hour", () => {
    const t1 = new Date("2026-07-28T10:15:00.000Z");
    const t2 = new Date("2026-07-28T10:45:00.000Z");

    expect(computeRotationId(t1)).toBe(computeRotationId(t2));
  });

  it("changes rotation across an hour boundary", () => {
    const t1 = new Date("2026-07-28T10:59:59.000Z");
    const t2 = new Date("2026-07-28T11:00:01.000Z");

    expect(computeRotationId(t1)).not.toBe(computeRotationId(t2));
  });

  it("selectClipsForRotation is deterministic for the same rotation_id", () => {
    const clipsA = selectClipsForRotation(42);
    const clipsB = selectClipsForRotation(42);

    expect(clipsA.map((c) => c.clip_id)).toEqual(clipsB.map((c) => c.clip_id));
  });

  it("selectClipsForRotation returns different windows for different rotation ids", () => {
    const clipsA = selectClipsForRotation(0);
    const clipsB = selectClipsForRotation(1);

    expect(clipsA.map((c) => c.clip_id)).not.toEqual(clipsB.map((c) => c.clip_id));
  });

  it("rotates_at is a valid future ISO timestamp", async () => {
    const res = await GET();
    const data = await res.json();

    expect(new Date(data.rotates_at).getTime()).toBeGreaterThan(Date.now());
  });
});
