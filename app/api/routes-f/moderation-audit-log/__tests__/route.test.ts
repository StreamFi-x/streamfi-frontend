jest.mock("@/lib/auth/verify-session", () => ({ verifySession: jest.fn() }));

import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { GET } from "../route";
import { modStore } from "../../mod-team/route";
import { __resetAuditLogStore, logModerationAction } from "../store";

const BASE = "http://localhost/api/routes-f/moderation-audit-log";
const verify = verifySession as unknown as jest.Mock;

function mockSession(userId: string) {
  verify.mockResolvedValue({
    ok: true,
    userId,
    wallet: null,
    privyId: null,
    username: null,
    email: null,
  });
}

function req(qs: string): NextRequest {
  return new NextRequest(`${BASE}${qs}`);
}

beforeEach(() => {
  jest.clearAllMocks();
  __resetAuditLogStore();
  modStore.clear();
  mockSession("mod-1");
  modStore.set("creator-1:mod-1", {
    creator_id: "creator-1",
    viewer_id: "mod-1",
    role: "mod",
    added_at: new Date().toISOString(),
  });
});

describe("GET /api/routes-f/moderation-audit-log", () => {
  it("returns the session's 401 response when unauthenticated", async () => {
    verify.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await GET(req("?creator_id=creator-1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when creator_id is missing", async () => {
    const res = await GET(req(""));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid action filter", async () => {
    const res = await GET(
      req("?creator_id=creator-1&action=not-a-real-action")
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for a non-numeric page", async () => {
    const res = await GET(req("?creator_id=creator-1&page=abc"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a limit above 100", async () => {
    const res = await GET(req("?creator_id=creator-1&limit=101"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a page below 1", async () => {
    const res = await GET(req("?creator_id=creator-1&page=0"));
    expect(res.status).toBe(400);
  });

  it("returns 403 when the caller is not a moderator of creator_id", async () => {
    mockSession("random-viewer");
    const res = await GET(req("?creator_id=creator-1"));
    expect(res.status).toBe(403);
  });

  it("allows the channel owner (userId === creator_id) even without a mod-team row", async () => {
    mockSession("creator-1");
    const res = await GET(req("?creator_id=creator-1"));
    expect(res.status).toBe(200);
  });

  it("returns an empty page when there are no entries yet", async () => {
    const res = await GET(req("?creator_id=creator-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      entries: [],
      total: 0,
      page: 1,
      limit: 20,
      has_more: false,
    });
  });

  it("returns entries for the requested channel only, newest first", async () => {
    logModerationAction({
      creator_id: "creator-1",
      moderator_id: "mod-1",
      action: "ban",
      target_viewer_id: "viewer-1",
      reason: "spam",
    });
    // small delay isn't needed — different call, but ensure ordering by
    // manipulating action type/order via multiple entries with distinct actions
    logModerationAction({
      creator_id: "creator-1",
      moderator_id: "mod-1",
      action: "unban",
      target_viewer_id: "viewer-1",
    });
    logModerationAction({
      creator_id: "other-creator",
      moderator_id: "mod-2",
      action: "ban",
      target_viewer_id: "viewer-9",
    });

    const res = await GET(req("?creator_id=creator-1"));
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.entries).toHaveLength(2);
    expect(body.entries[0].action).toBe("unban"); // most recent first
    expect(
      body.entries.every(
        (e: { creator_id: string }) => e.creator_id === "creator-1"
      )
    ).toBe(true);
  });

  it("filters by action type", async () => {
    logModerationAction({
      creator_id: "creator-1",
      moderator_id: "mod-1",
      action: "ban",
      target_viewer_id: "viewer-1",
    });
    logModerationAction({
      creator_id: "creator-1",
      moderator_id: "mod-1",
      action: "timeout",
      target_viewer_id: "viewer-2",
    });

    const res = await GET(req("?creator_id=creator-1&action=timeout"));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.entries[0].action).toBe("timeout");
  });

  it("paginates results and reports has_more correctly", async () => {
    for (let i = 0; i < 5; i++) {
      logModerationAction({
        creator_id: "creator-1",
        moderator_id: "mod-1",
        action: "ban",
        target_viewer_id: `viewer-${i}`,
      });
    }

    const page1 = await GET(req("?creator_id=creator-1&limit=2&page=1"));
    const body1 = await page1.json();
    expect(body1.entries).toHaveLength(2);
    expect(body1.total).toBe(5);
    expect(body1.has_more).toBe(true);

    const page3 = await GET(req("?creator_id=creator-1&limit=2&page=3"));
    const body3 = await page3.json();
    expect(body3.entries).toHaveLength(1);
    expect(body3.has_more).toBe(false);
  });

  it("returns an empty page (not an error) when requesting a page past the end", async () => {
    logModerationAction({
      creator_id: "creator-1",
      moderator_id: "mod-1",
      action: "ban",
      target_viewer_id: "viewer-1",
    });
    const res = await GET(req("?creator_id=creator-1&page=99"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toEqual([]);
    expect(body.has_more).toBe(false);
  });
});
