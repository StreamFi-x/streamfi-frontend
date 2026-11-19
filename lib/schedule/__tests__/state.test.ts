import {
  canTransition,
  isNoShow,
  isWithinLiveSyncWindow,
  nextWeeklyOccurrence,
} from "../state";
import { REMINDER_LEAD_MINUTES, reminderFiresAt } from "../reminder-policy";

describe("stream schedule state machine", () => {
  it("allows upcoming -> live, cancelled, missed", () => {
    expect(canTransition("upcoming", "live")).toBe(true);
    expect(canTransition("upcoming", "cancelled")).toBe(true);
    expect(canTransition("upcoming", "missed")).toBe(true);
  });

  it("allows live -> completed only", () => {
    expect(canTransition("live", "completed")).toBe(true);
    expect(canTransition("live", "cancelled")).toBe(false);
  });

  it("rejects transitions out of terminal states", () => {
    expect(canTransition("completed", "live")).toBe(false);
    expect(canTransition("cancelled", "upcoming")).toBe(false);
    expect(canTransition("missed", "live")).toBe(false);
  });

  it("rejects transitions to the same state", () => {
    expect(canTransition("upcoming", "upcoming")).toBe(false);
  });
});

describe("nextWeeklyOccurrence", () => {
  it("adds exactly 7 days in UTC instants", () => {
    const start = new Date("2026-06-01T20:00:00Z");
    const next = nextWeeklyOccurrence(start);
    expect(next.toISOString()).toBe("2026-06-08T20:00:00.000Z");
  });
});

describe("isNoShow", () => {
  const scheduledAt = new Date("2026-06-01T20:00:00Z");

  it("is false while still upcoming and before the deadline", () => {
    expect(
      isNoShow({
        scheduledAt,
        durationMins: 120,
        status: "upcoming",
        now: new Date("2026-06-01T21:00:00Z"),
      })
    ).toBe(false);
  });

  it("is true once duration + grace has elapsed with no live session", () => {
    // 120 min duration + 30 min grace = deadline at 22:30
    expect(
      isNoShow({
        scheduledAt,
        durationMins: 120,
        status: "upcoming",
        now: new Date("2026-06-01T22:31:00Z"),
      })
    ).toBe(true);
  });

  it("is never a no-show for a status other than upcoming", () => {
    expect(
      isNoShow({
        scheduledAt,
        durationMins: 120,
        status: "live",
        now: new Date("2026-06-02T00:00:00Z"),
      })
    ).toBe(false);
  });

  it("a creator starting late but before the grace deadline is not a no-show", () => {
    expect(
      isNoShow({
        scheduledAt,
        durationMins: 120,
        status: "upcoming",
        now: new Date("2026-06-01T20:45:00Z"),
      })
    ).toBe(false);
  });
});

describe("isWithinLiveSyncWindow", () => {
  const scheduledAt = new Date("2026-06-01T20:00:00Z");

  it("is true within 30 minutes either side", () => {
    expect(isWithinLiveSyncWindow(scheduledAt, new Date("2026-06-01T19:35:00Z"))).toBe(true);
    expect(isWithinLiveSyncWindow(scheduledAt, new Date("2026-06-01T20:25:00Z"))).toBe(true);
  });

  it("is false outside the window", () => {
    expect(isWithinLiveSyncWindow(scheduledAt, new Date("2026-06-01T19:00:00Z"))).toBe(false);
  });
});

describe("reminderFiresAt / REMINDER_LEAD_MINUTES", () => {
  it("fires the configured lead time before the scheduled start", () => {
    const scheduledAt = new Date("2026-06-01T20:00:00Z");
    const fires = reminderFiresAt(scheduledAt);
    expect(scheduledAt.getTime() - fires.getTime()).toBe(REMINDER_LEAD_MINUTES * 60 * 1000);
  });
});
