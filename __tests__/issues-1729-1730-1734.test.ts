/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { createSqlMock } from "@/testing/sql-mock";

const mockDb = createSqlMock();

jest.mock("@vercel/postgres", () => ({
  sql: Object.assign((...args: unknown[]) => mockDb.sql(...args), {
    query: jest.fn(async () => ({ rows: [] })),
  }),
}));

jest.mock("@/utils/send-email", () => ({
  sendWelcomeEmail: jest.fn(async () => true),
  sendWelcomeRegistrationEmail: jest.fn(async () => true),
}));

jest.mock("@/lib/cache/invalidation", () => ({
  invalidateUserCaches: jest.fn(async () => undefined),
}));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(async () => ({
    ok: true,
    userId: "u-owner",
    wallet: "GOWNER00000000000000000000000000000000000000000000000000",
    privyId: "privy-owner",
    username: "oldhandle",
  })),
}));

jest.mock("@/lib/dev-mode", () => ({
  shouldBypassAuth: jest.fn(() => false),
}));

jest.mock("@/lib/mux/server", () => ({
  updateMuxStreamRecording: jest.fn(async () => ({ success: true })),
  createMuxStream: jest.fn(async () => ({
    id: "mux-1",
    playbackId: "pb-1",
    streamKey: "sk-1",
    rtmpUrl: "rtmp://live",
  })),
}));

jest.mock("@/utils/upload/cloudinary", () => ({
  uploadImageFromBuffer: jest.fn(),
  deleteImage: jest.fn(),
  extractPublicIdFromUrl: jest.fn(() => null),
}));

import { POST as waitlistSubscribe } from "@/app/api/waitlist/subscribe/route";
import { PUT as updateByWallet } from "@/app/api/users/updates/[wallet]/route";
import { PUT as updateByPrivy } from "@/app/api/users/updates/privy/[privyId]/route";
import { GET as getUserProfile } from "@/app/api/users/[username]/route";
import { POST as registerUser } from "@/app/api/users/register/route";
import {
  checkUsernameChangeCooldown,
  checkUsernameReleaseHold,
  getUsernameOwnershipWarning,
  recordUsernameChange,
  resolveUsernameRedirect,
} from "@/lib/users/username-history";
import { resetAppCacheForTests } from "@/lib/cache";

const OWNER_WALLET = "GOWNER00000000000000000000000000000000000000000000000000";

function makeFormRequest(url: string, fields: Record<string, string>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    form.append(k, v);
  }
  return new NextRequest(url, {
    method: "PUT",
    body: form,
  });
}

describe("Issues #1729, #1730, #1734", () => {
  beforeEach(() => {
    mockDb.reset();
    resetAppCacheForTests();
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Issue #1729: waitlist resubscribe clears name when null or empty", () => {
    it("clears the stored name when resubscribing with an explicit null name", async () => {
      mockDb.on(/SELECT unsubscribed_at FROM subscribers/, {
        rows: [{ unsubscribed_at: "2026-09-01T00:00:00.000Z" }],
      });
      mockDb.on(/UPDATE subscribers/, { rowCount: 1 });

      const req = new NextRequest("http://localhost/api/waitlist/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "resub@example.com",
          name: null,
        }),
      });

      const res = await waitlistSubscribe(req);
      expect(res.status).toBe(201);

      const updateCalls = mockDb.callsMatching(/UPDATE subscribers/);
      expect(updateCalls).toHaveLength(1);
      expect(updateCalls[0].text).not.toMatch(/COALESCE/i);
      expect(updateCalls[0].values).toEqual(
        ["", "resub@example.com"].map((_, i) =>
          i === 0 ? null : "resub@example.com"
        )
      );
    });

    it("clears the stored name when resubscribing with an explicit empty or whitespace string", async () => {
      mockDb.on(/SELECT unsubscribed_at FROM subscribers/, {
        rows: [{ unsubscribed_at: "2026-09-01T00:00:00.000Z" }],
      });
      mockDb.on(/UPDATE subscribers/, { rowCount: 1 });

      const req = new NextRequest("http://localhost/api/waitlist/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "resub@example.com",
          name: "   ",
        }),
      });

      const res = await waitlistSubscribe(req);
      expect(res.status).toBe(201);

      const updateCalls = mockDb.callsMatching(/UPDATE subscribers/);
      expect(updateCalls).toHaveLength(1);
      expect(updateCalls[0].values[0]).toBeNull();
    });

    it("updates the stored name when resubscribing with a new non-empty name", async () => {
      mockDb.on(/SELECT unsubscribed_at FROM subscribers/, {
        rows: [{ unsubscribed_at: "2026-09-01T00:00:00.000Z" }],
      });
      mockDb.on(/UPDATE subscribers/, { rowCount: 1 });

      const req = new NextRequest("http://localhost/api/waitlist/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "resub@example.com",
          name: "Alice Streamer",
        }),
      });

      const res = await waitlistSubscribe(req);
      expect(res.status).toBe(201);

      const updateCalls = mockDb.callsMatching(/UPDATE subscribers/);
      expect(updateCalls).toHaveLength(1);
      expect(updateCalls[0].values[0]).toBe("Alice Streamer");
    });
  });

  describe("Issue #1730: username change history, redirects, and cooldown protection", () => {
    it("enforces cooldown when user attempts rapid repeated username changes", async () => {
      const fiveDaysAgo = new Date(
        Date.now() - 5 * 24 * 60 * 60 * 1000
      ).toISOString();

      const cooldown = await checkUsernameChangeCooldown({
        userId: "u-owner",
        lastChangedAt: fiveDaysAgo,
      });

      expect(cooldown.allowed).toBe(false);
      expect(cooldown.remainingDays).toBeGreaterThanOrEqual(24);
      expect(cooldown.retryAfterSeconds).toBeGreaterThan(0);
      expect(cooldown.nextAllowedAt).toBeTruthy();
    });

    it("blocks PUT /api/users/updates/[wallet] with 429 when within username change cooldown", async () => {
      const twoDaysAgo = new Date(
        Date.now() - 2 * 24 * 60 * 60 * 1000
      ).toISOString();

      mockDb.on(/SELECT id, username, email, bio/, {
        rows: [
          {
            id: "u-owner",
            username: "oldhandle",
            email: "owner@example.com",
            bio: "hello",
            wallet: OWNER_WALLET,
            username_changed_at: twoDaysAgo,
          },
        ],
      });

      const req = makeFormRequest(
        `http://localhost/api/users/updates/${OWNER_WALLET}`,
        { username: "newhandle" }
      );
      const res = await updateByWallet(req, {
        params: Promise.resolve({ wallet: OWNER_WALLET }),
      });

      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.code).toBe("USERNAME_CHANGE_COOLDOWN");
      expect(res.headers.get("Retry-After")).toBeTruthy();
      expect(mockDb.callsMatching(/UPDATE users SET/)).toHaveLength(0);
    });

    it("blocks PUT /api/users/updates/privy/[privyId] with 429 when within cooldown", async () => {
      const oneDayAgo = new Date(
        Date.now() - 1 * 24 * 60 * 60 * 1000
      ).toISOString();

      mockDb.on(/SELECT id, username, email, bio/, {
        rows: [
          {
            id: "u-owner",
            username: "oldhandle",
            email: "owner@example.com",
            bio: "hello",
            privy_id: "privy-owner",
            username_changed_at: oneDayAgo,
          },
        ],
      });

      const req = makeFormRequest(
        "http://localhost/api/users/updates/privy/privy-owner",
        { username: "newhandle" }
      );
      const res = await updateByPrivy(req, {
        params: Promise.resolve({ privyId: "privy-owner" }),
      });

      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.code).toBe("USERNAME_CHANGE_COOLDOWN");
    });

    it("records username change in username_history when cooldown has elapsed", async () => {
      const fortyDaysAgo = new Date(
        Date.now() - 40 * 24 * 60 * 60 * 1000
      ).toISOString();

      mockDb.on(/SELECT id, username, email, bio/, {
        rows: [
          {
            id: "u-owner",
            username: "oldhandle",
            email: "owner@example.com",
            bio: "hello",
            wallet: OWNER_WALLET,
            username_changed_at: fortyDaysAgo,
          },
        ],
      });
      mockDb.on(/SELECT id FROM users WHERE LOWER\(username\)/, { rows: [] });
      mockDb.on(/FROM username_history/, { rows: [] });
      mockDb.on(/UPDATE users SET/, {
        rows: [{ id: "u-owner", username: "newhandle" }],
      });
      mockDb.on(/INSERT INTO username_history/, { rowCount: 1 });
      mockDb.on(/UPDATE users SET username_changed_at/, { rowCount: 1 });

      const req = makeFormRequest(
        `http://localhost/api/users/updates/${OWNER_WALLET}`,
        { username: "newhandle" }
      );
      const res = await updateByWallet(req, {
        params: Promise.resolve({ wallet: OWNER_WALLET }),
      });

      expect(res.status).toBe(200);
      const historyInserts = mockDb.callsMatching(
        /INSERT INTO username_history/
      );
      expect(historyInserts).toHaveLength(1);
      expect(historyInserts[0].values[0]).toBe("u-owner");
      expect(historyInserts[0].values[1]).toBe("oldhandle");
      expect(historyInserts[0].values[2]).toBe("newhandle");
    });

    it("redirects GET /api/users/[username] from a previous handle to the new active handle", async () => {
      const futureRedirectUntil = new Date(
        Date.now() + 60 * 24 * 60 * 60 * 1000
      ).toISOString();

      mockDb.on(/FROM users u WHERE LOWER\(u\.username\)/, { rows: [] });
      mockDb.on(/FROM username_history h/, {
        rows: [
          {
            previous_username: "oldhandle",
            new_username: "newhandle",
            user_id: "u-owner",
            changed_at: new Date().toISOString(),
            redirect_until: futureRedirectUntil,
            current_username: "newhandle",
            deleted_at: null,
          },
        ],
      });

      const req = new NextRequest("http://localhost/api/users/oldhandle");
      const res = await getUserProfile(req, {
        params: Promise.resolve({ username: "oldhandle" }),
      });

      expect(res.status).toBe(307);
      expect(res.headers.get("Location")).toBe("/newhandle");
      expect(res.headers.get("X-Redirect-Username")).toBe("newhandle");
      const body = await res.json();
      expect(body).toMatchObject({
        redirect: true,
        previousUsername: "oldhandle",
        targetUsername: "newhandle",
        redirectTo: "/newhandle",
      });
    });

    it("does not redirect when the redirect window has expired", async () => {
      const expiredRedirectUntil = new Date(
        Date.now() - 5 * 24 * 60 * 60 * 1000
      ).toISOString();

      mockDb.on(/FROM username_history h/, {
        rows: [
          {
            previous_username: "ancienthandle",
            new_username: "newhandle",
            user_id: "u-owner",
            changed_at: new Date(
              Date.now() - 100 * 24 * 60 * 60 * 1000
            ).toISOString(),
            redirect_until: expiredRedirectUntil,
            current_username: "newhandle",
            deleted_at: null,
          },
        ],
      });

      const resolution = await resolveUsernameRedirect("ancienthandle");
      expect(resolution.shouldRedirect).toBe(false);
      expect(resolution.targetUsername).toBeNull();
    });
  });

  describe("Issue #1734: username release and re-registration protection & ownership warning", () => {
    it("prevents a different account from claiming a recently released username during the hold period", async () => {
      const holdUntil = new Date(
        Date.now() + 20 * 24 * 60 * 60 * 1000
      ).toISOString();

      mockDb.on(/FROM username_history WHERE LOWER\(previous_username\)/, {
        rows: [
          {
            user_id: "original-creator-id",
            changed_at: new Date(
              Date.now() - 10 * 24 * 60 * 60 * 1000
            ).toISOString(),
            hold_until: holdUntil,
          },
        ],
      });

      const hold = await checkUsernameReleaseHold({
        username: "oldhandle",
        requestingUserId: "different-user-id",
      });

      expect(hold.held).toBe(true);
      expect(hold.previousOwnerId).toBe("original-creator-id");
      expect(hold.retryAfterSeconds).toBeGreaterThan(0);

      // Same original owner is allowed to reclaim their own handle
      const selfReclaim = await checkUsernameReleaseHold({
        username: "oldhandle",
        requestingUserId: "original-creator-id",
      });
      expect(selfReclaim.held).toBe(false);
    });

    it("blocks registration of a recently released username with 409 USERNAME_RECENTLY_RELEASED", async () => {
      const holdUntil = new Date(
        Date.now() + 15 * 24 * 60 * 60 * 1000
      ).toISOString();

      mockDb.on(/SELECT 1 FROM users WHERE email =/, { rows: [] });
      mockDb.on(/SELECT 1 FROM users WHERE wallet =/, { rows: [] });
      mockDb.on(/SELECT id FROM users WHERE LOWER\(username\)/, { rows: [] });
      mockDb.on(/FROM username_history WHERE LOWER\(previous_username\)/, {
        rows: [
          {
            user_id: "original-creator-id",
            changed_at: new Date().toISOString(),
            hold_until: holdUntil,
          },
        ],
      });

      const req = new NextRequest("http://localhost/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "newuser@example.com",
          username: "releasedhandle",
          wallet: "GNEWUSER000000000000000000000000000000000000000000000000",
        }),
      });

      const res = await registerUser(req);
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.code).toBe("USERNAME_RECENTLY_RELEASED");
    });

    it("surfaces ownership change warning when visiting a username recently re-registered by a different user", async () => {
      const fortyDaysAgo = new Date(
        Date.now() - 40 * 24 * 60 * 60 * 1000
      ).toISOString();

      mockDb.on(/FROM users u WHERE LOWER\(u\.username\)/, {
        rows: [
          {
            id: "new-owner-id",
            username: "sharedlinkhandle",
            wallet: "GNEWOWNER",
            bio: "New channel",
            is_live: true,
            stream_access_type: "public",
          },
        ],
      });

      mockDb.on(/FROM username_history WHERE LOWER\(previous_username\)/, {
        rows: [
          {
            user_id: "previous-owner-id",
            changed_at: fortyDaysAgo,
          },
        ],
      });

      const warning = await getUsernameOwnershipWarning({
        username: "sharedlinkhandle",
        currentUserId: "new-owner-id",
      });
      expect(warning.hasRecentOwnershipChange).toBe(true);
      expect(warning.previousOwnerId).toBe("previous-owner-id");
      expect(warning.notice).toContain("recently released");

      const req = new NextRequest(
        "http://localhost/api/users/sharedlinkhandle"
      );
      const res = await getUserProfile(req, {
        params: Promise.resolve({ username: "sharedlinkhandle" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.user.recently_reregistered).toBe(true);
      expect(body.user.ownership_change_notice).toContain(
        "not the same channel as before"
      );
      expect(body.user.previous_owner_released_at).toBe(fortyDaysAgo);
    });

    it("does not surface ownership change warning when recordUsernameChange was not from a different user within window", async () => {
      mockDb.on(/FROM username_history WHERE LOWER\(previous_username\)/, {
        rows: [],
      });

      const warning = await getUsernameOwnershipWarning({
        username: "stablehandle",
        currentUserId: "u-1",
      });
      expect(warning.hasRecentOwnershipChange).toBe(false);
      expect(warning.notice).toBeNull();
    });
  });
});
