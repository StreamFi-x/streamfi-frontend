import { POST } from "./route";
import { GET, resetCarouselRotation, ROTATION_SIZE } from "../route";

describe("POST /api/routesF/featured-clip-carousel/next", () => {
  beforeEach(() => {
    resetCarouselRotation();
  });

  it("advances the rotation_id relative to the current GET rotation", async () => {
    const before = await GET();
    const beforeData = await before.json();

    const advanced = await POST();
    const advancedData = await advanced.json();

    expect(advancedData.rotation_id).toBe(beforeData.rotation_id + 1);
  });

  it("returns ROTATION_SIZE clips", async () => {
    const res = await POST();
    const data = await res.json();

    expect(data.clips).toHaveLength(ROTATION_SIZE);
  });

  it("advancing twice moves the rotation forward by two", async () => {
    const before = await GET();
    const beforeData = await before.json();

    await POST();
    const second = await POST();
    const secondData = await second.json();

    expect(secondData.rotation_id).toBe(beforeData.rotation_id + 2);
  });

  it("changes which clips are shown after advancing", async () => {
    const before = await GET();
    const beforeData = await before.json();

    const after = await POST();
    const afterData = await after.json();

    expect(afterData.clips.map((c: { clip_id: string }) => c.clip_id)).not.toEqual(
      beforeData.clips.map((c: { clip_id: string }) => c.clip_id),
    );
  });
});
