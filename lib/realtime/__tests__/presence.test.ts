import {
  recordViewerHeartbeat,
  removeViewerPresence,
  getLivePresence,
  resetPresenceForTests,
  MAX_PRESENCE_DISPLAY_LIMIT,
} from "../presence";

describe("Realtime Viewer Presence System (#1133, #1134)", () => {
  beforeEach(() => {
    resetPresenceForTests();
  });

  it("records and updates active viewer heartbeat", async () => {
    const streamId = "stream-test-1";
    const snapshot = await recordViewerHeartbeat(streamId, {
      sessionId: "session-1",
      userId: "user-1",
      username: "Alice",
      avatar: "/avatar1.png",
    });

    expect(snapshot.totalViewers).toBe(1);
    expect(snapshot.authenticatedViewers).toHaveLength(1);
    expect(snapshot.authenticatedViewers[0].username).toBe("Alice");
    expect(snapshot.anonymousCount).toBe(0);
  });

  it("distinguishes authenticated and anonymous viewers", async () => {
    const streamId = "stream-test-2";
    await recordViewerHeartbeat(streamId, {
      sessionId: "session-authed",
      userId: "user-authed",
      username: "Bob",
    });
    await recordViewerHeartbeat(streamId, {
      sessionId: "session-anon",
      isAnonymous: true,
    });

    const snapshot = await getLivePresence(streamId);
    expect(snapshot.totalViewers).toBe(2);
    expect(snapshot.authenticatedViewers).toHaveLength(1);
    expect(snapshot.authenticatedViewers[0].username).toBe("Bob");
    expect(snapshot.anonymousCount).toBe(1);
  });

  it("removes viewer presence on explicit leave", async () => {
    const streamId = "stream-test-3";
    await recordViewerHeartbeat(streamId, {
      sessionId: "session-leave",
      userId: "user-leave",
      username: "Charlie",
    });

    let snapshot = await getLivePresence(streamId);
    expect(snapshot.totalViewers).toBe(1);

    await removeViewerPresence(streamId, "session-leave");

    snapshot = await getLivePresence(streamId);
    expect(snapshot.totalViewers).toBe(0);
    expect(snapshot.authenticatedViewers).toHaveLength(0);
  });

  it("caps presence display list for high-viewer-count streams (#1133)", async () => {
    const streamId = "stream-test-high";
    const totalSimulated = MAX_PRESENCE_DISPLAY_LIMIT + 25;

    for (let i = 0; i < totalSimulated; i++) {
      await recordViewerHeartbeat(streamId, {
        sessionId: `session-bulk-${i}`,
        userId: `user-bulk-${i}`,
        username: `User-${i}`,
      });
    }

    const snapshot = await getLivePresence(streamId);
    expect(snapshot.totalViewers).toBe(totalSimulated);
    expect(snapshot.authenticatedViewers.length).toBe(MAX_PRESENCE_DISPLAY_LIMIT);
    expect(snapshot.sampled).toBe(true);
  });
});
