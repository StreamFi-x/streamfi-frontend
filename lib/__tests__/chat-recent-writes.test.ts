/**
 * @jest-environment node
 */
import type { ChatMessage } from "@/types/chat";
import {
  RECENT_WRITE_TTL_MS,
  reconcileWithRecentWrites,
  recentWritesFor,
  rememberDeleted,
  rememberSent,
  type RecentWrites,
} from "@/lib/chat-recent-writes";

const msg = (id: number, second: number): ChatMessage => ({
  id,
  username: "u",
  message: `m${id}`,
  color: "#000",
  messageType: "message",
  createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, second)).toISOString(),
});

const fresh = (): RecentWrites => ({ sent: [], deleted: new Map() });

describe("reconcileWithRecentWrites", () => {
  it("returns the fetched window untouched when there are no recent writes", () => {
    const fetched = [msg(1, 1)];
    expect(reconcileWithRecentWrites(fetched, fresh(), 0)).toBe(fetched);
    expect(reconcileWithRecentWrites(fetched, undefined, 0)).toBe(fetched);
  });

  it("keeps a just-sent message that a stale shared window does not have yet, in order", () => {
    const writes = fresh();
    rememberSent(writes, msg(3, 2), 0);
    const merged = reconcileWithRecentWrites(
      [msg(1, 1), msg(4, 3)],
      writes,
      1_000
    );
    expect(merged.map(m => m.id)).toEqual([1, 3, 4]);
  });

  it("does not duplicate a sent message once the window includes it", () => {
    const writes = fresh();
    rememberSent(writes, msg(3, 2), 0);
    const merged = reconcileWithRecentWrites(
      [msg(1, 1), msg(3, 2)],
      writes,
      1_000
    );
    expect(merged.map(m => m.id)).toEqual([1, 3]);
  });

  it("hides a just-deleted message that a stale window still contains", () => {
    const writes = fresh();
    rememberDeleted(writes, 1, 0);
    expect(
      reconcileWithRecentWrites([msg(1, 1), msg(2, 2)], writes, 1_000).map(
        m => m.id
      )
    ).toEqual([2]);
  });

  it("forgets writes after the TTL so the server stays authoritative", () => {
    const writes = fresh();
    rememberSent(writes, msg(3, 2), 0);
    rememberDeleted(writes, 1, 0);
    const merged = reconcileWithRecentWrites(
      [msg(1, 1)],
      writes,
      RECENT_WRITE_TTL_MS
    );
    expect(merged.map(m => m.id)).toEqual([1]);
    expect(writes.sent).toHaveLength(0);
    expect(writes.deleted.size).toBe(0);
  });

  it("keeps writes per stream", () => {
    expect(recentWritesFor("pb-a")).toBe(recentWritesFor("pb-a"));
    expect(recentWritesFor("pb-a")).not.toBe(recentWritesFor("pb-b"));
  });
});
