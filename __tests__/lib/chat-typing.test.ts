import {
  MAX_NAMED_TYPISTS,
  TYPING_EXPIRY_MS,
  TYPING_FULL_BROADCAST_MAX_VIEWERS,
  TYPING_SAMPLED_MAX_VIEWERS,
  TYPING_STOP_GRACE_MS,
  TypingTracker,
  decideTypingBroadcast,
  formatTypingLabel,
  typingChannel,
  type TypingPolicyInput,
} from "@/lib/chat-typing";

const base: TypingPolicyInput = {
  state: "typing",
  spikeLevel: "normal",
  viewerCount: 10,
  isTimedOut: false,
  slowModeRemainingMs: 0,
  roomBudgetAvailable: true,
};

describe("typingChannel", () => {
  it("is separate from the persisted chat channel", () => {
    expect(typingChannel("abc")).toBe("stream:abc:typing");
    expect(typingChannel("abc")).not.toBe("stream:abc:chat");
  });
});

describe("decideTypingBroadcast", () => {
  it("broadcasts in a small, healthy room", () => {
    expect(decideTypingBroadcast(base)).toEqual({ broadcast: true });
  });

  it("sheds typing at critical load but not at degraded load", () => {
    expect(decideTypingBroadcast({ ...base, spikeLevel: "critical" })).toEqual({
      broadcast: false,
      reason: "load-shed",
    });
    expect(decideTypingBroadcast({ ...base, spikeLevel: "degraded" })).toEqual({
      broadcast: true,
    });
  });

  it("suppresses timed-out (muted) users", () => {
    expect(decideTypingBroadcast({ ...base, isTimedOut: true })).toEqual({
      broadcast: false,
      reason: "timed-out",
    });
  });

  it("suppresses users still inside their slow-mode cooldown", () => {
    expect(decideTypingBroadcast({ ...base, slowModeRemainingMs: 1 })).toEqual({
      broadcast: false,
      reason: "slow-mode",
    });
    expect(decideTypingBroadcast({ ...base, slowModeRemainingMs: 0 })).toEqual({
      broadcast: true,
    });
  });

  it("still lets a restricted user's 'stopped' through to clear old indicators", () => {
    expect(
      decideTypingBroadcast({
        ...base,
        state: "stopped",
        isTimedOut: true,
        slowModeRemainingMs: 5000,
      })
    ).toEqual({ broadcast: true });
  });

  describe("viewer tiers", () => {
    it("ignores the room budget up to the full-broadcast limit", () => {
      expect(
        decideTypingBroadcast({
          ...base,
          viewerCount: TYPING_FULL_BROADCAST_MAX_VIEWERS,
          roomBudgetAvailable: false,
        })
      ).toEqual({ broadcast: true });
    });

    it("samples via the room budget in the middle tier", () => {
      const mid = TYPING_FULL_BROADCAST_MAX_VIEWERS + 1;
      expect(decideTypingBroadcast({ ...base, viewerCount: mid })).toEqual({
        broadcast: true,
      });
      expect(
        decideTypingBroadcast({
          ...base,
          viewerCount: mid,
          roomBudgetAvailable: false,
        })
      ).toEqual({ broadcast: false, reason: "room-sampled" });
    });

    it("disables typing entirely above the cutoff, including 'stopped'", () => {
      const huge = TYPING_SAMPLED_MAX_VIEWERS + 1;
      expect(decideTypingBroadcast({ ...base, viewerCount: huge })).toEqual({
        broadcast: false,
        reason: "viewer-cutoff",
      });
      expect(
        decideTypingBroadcast({ ...base, viewerCount: huge, state: "stopped" })
      ).toEqual({ broadcast: false, reason: "viewer-cutoff" });
    });

    it("keeps typing on at exactly the cutoff", () => {
      expect(
        decideTypingBroadcast({
          ...base,
          viewerCount: TYPING_SAMPLED_MAX_VIEWERS,
        })
      ).toEqual({ broadcast: true });
    });
  });
});

describe("TypingTracker", () => {
  it("lists active typists in arrival order", () => {
    const t = new TypingTracker();
    t.typing("a", "Alice", 0);
    t.typing("b", "Bob", 10);
    expect(t.active(20).map(x => x.username)).toEqual(["Alice", "Bob"]);
  });

  it("expires a typist with no update, with no 'stopped' event", () => {
    const t = new TypingTracker();
    t.typing("a", "Alice", 0);
    expect(t.active(TYPING_EXPIRY_MS - 1)).toHaveLength(1);
    expect(t.active(TYPING_EXPIRY_MS)).toHaveLength(0);
  });

  it("a repeated 'typing' refreshes the expiry", () => {
    const t = new TypingTracker();
    t.typing("a", "Alice", 0);
    t.typing("a", "Alice", 4000);
    expect(t.active(TYPING_EXPIRY_MS + 1)).toHaveLength(1);
    expect(t.active(4000 + TYPING_EXPIRY_MS)).toHaveLength(0);
  });

  it("keeps a stopped typist for the grace period so restarts do not flicker", () => {
    const t = new TypingTracker();
    t.typing("a", "Alice", 0);
    t.stopped("a", 100);
    expect(t.active(100 + TYPING_STOP_GRACE_MS - 1)).toHaveLength(1);
    // Typing again inside the grace period brings the full expiry back.
    t.typing("a", "Alice", 100 + TYPING_STOP_GRACE_MS - 1);
    expect(t.active(100 + TYPING_STOP_GRACE_MS + 2000)).toHaveLength(1);
  });

  it("drops a stopped typist once grace elapses", () => {
    const t = new TypingTracker();
    t.typing("a", "Alice", 0);
    t.stopped("a", 100);
    expect(t.active(100 + TYPING_STOP_GRACE_MS)).toHaveLength(0);
  });

  it("never extends expiry when 'stopped' arrives late", () => {
    const t = new TypingTracker();
    t.typing("a", "Alice", 0);
    t.stopped("a", TYPING_EXPIRY_MS - 100);
    expect(t.active(TYPING_EXPIRY_MS)).toHaveLength(0);
  });

  it("ignores 'stopped' for an unknown user", () => {
    const t = new TypingTracker();
    t.stopped("ghost", 0);
    expect(t.active(0)).toEqual([]);
    expect(t.nextExpiry()).toBeNull();
  });

  it("reports the earliest upcoming expiry", () => {
    const t = new TypingTracker();
    t.typing("a", "Alice", 1000);
    t.typing("b", "Bob", 0);
    expect(t.nextExpiry()).toBe(TYPING_EXPIRY_MS);
  });

  it("remove and clear drop typists immediately", () => {
    const t = new TypingTracker();
    t.typing("a", "Alice", 0);
    t.typing("b", "Bob", 0);
    t.remove("a");
    expect(t.active(1).map(x => x.key)).toEqual(["b"]);
    t.clear();
    expect(t.active(1)).toEqual([]);
  });
});

describe("formatTypingLabel", () => {
  const people = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ key: `k${i}`, username: `U${i}` }));

  it("returns null when nobody is typing", () => {
    expect(formatTypingLabel([])).toBeNull();
  });

  it("names one typist", () => {
    expect(formatTypingLabel(people(1))).toBe("U0 is typing…");
  });

  it("names up to MAX_NAMED_TYPISTS typists", () => {
    expect(MAX_NAMED_TYPISTS).toBe(2);
    expect(formatTypingLabel(people(2))).toBe("U0 and U1 are typing…");
  });

  it("collapses larger groups into a count", () => {
    expect(formatTypingLabel(people(3))).toBe("3 people are typing…");
    expect(formatTypingLabel(people(40))).toBe("40 people are typing…");
  });
});
