/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, moonPhaseAt, SYNODIC_MONTH, PHASE_NAMES } from "../route";

function callGet(query: string) {
  return GET(
    new NextRequest(`http://localhost/api/routes-f/moon-phase${query}`)
  );
}

describe("moonPhaseAt", () => {
  it("reports a near-new moon on known new-moon dates", () => {
    // NASA: new moon on 2024-01-11 and 2025-01-29.
    for (const day of ["2024-01-11", "2025-01-29"]) {
      const result = moonPhaseAt(new Date(`${day}T00:00:00Z`));
      expect(result.phase_name).toBe("new");
      expect(result.illumination_percent).toBeLessThan(2);
    }
  });

  it("reports a near-full moon on known full-moon dates", () => {
    // NASA: full moon on 2024-01-25 and 2025-01-13.
    for (const day of ["2024-01-25", "2025-01-13"]) {
      const result = moonPhaseAt(new Date(`${day}T00:00:00Z`));
      expect(result.phase_name).toBe("full");
      expect(result.illumination_percent).toBeGreaterThan(95);
    }
  });

  it("reports ~0% illumination at the reference new moon epoch", () => {
    // The epoch itself: 2000-01-06 18:14 UTC. age_days wraps to ~0.
    const result = moonPhaseAt(new Date(Date.UTC(2000, 0, 6, 18, 14, 0)));
    expect(result.age_days).toBeCloseTo(0, 1);
    expect(result.illumination_percent).toBeCloseTo(0, 1);
    expect(result.phase_name).toBe("new");
  });

  it("reports ~100% illumination half a synodic month after new moon", () => {
    const epoch = Date.UTC(2000, 0, 6, 18, 14, 0);
    const halfCycle = new Date(epoch + (SYNODIC_MONTH / 2) * 86_400_000);
    const result = moonPhaseAt(halfCycle);
    expect(result.phase_name).toBe("full");
    expect(result.illumination_percent).toBeCloseTo(100, 1);
    expect(result.age_days).toBeCloseTo(SYNODIC_MONTH / 2, 1);
  });

  it("walks through the eight phases across one synodic month", () => {
    const epoch = Date.UTC(2000, 0, 6, 18, 14, 0);
    const seen = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const t = new Date(epoch + ((i * SYNODIC_MONTH) / 8) * 86_400_000);
      seen.add(moonPhaseAt(t).phase_name);
    }
    expect(seen.size).toBe(8);
    for (const name of PHASE_NAMES) {
      expect(seen.has(name)).toBe(true);
    }
  });

  it("keeps age_days within [0, synodic month)", () => {
    for (const day of ["1999-06-01", "2000-01-06", "2030-12-31"]) {
      const { age_days } = moonPhaseAt(new Date(`${day}T00:00:00Z`));
      expect(age_days).toBeGreaterThanOrEqual(0);
      expect(age_days).toBeLessThan(SYNODIC_MONTH);
    }
  });
});

describe("GET /api/routes-f/moon-phase", () => {
  it("returns the phase for a valid date", async () => {
    const res = await callGet("?date=2024-01-25");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      phase_name: "full",
      illumination_percent: expect.any(Number),
      age_days: expect.any(Number),
    });
    expect(body.illumination_percent).toBeGreaterThan(95);
  });

  it("rejects a missing date param", async () => {
    const res = await callGet("");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid query parameters");
  });

  it("rejects a malformed date param", async () => {
    const res = await callGet("?date=Jan-25-2024");
    expect(res.status).toBe(400);
  });

  it("rejects a well-formed but impossible calendar date", async () => {
    const res = await callGet("?date=2024-02-30");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid query parameters");
  });
});
