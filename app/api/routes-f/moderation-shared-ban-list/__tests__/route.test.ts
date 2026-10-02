jest.mock("@/lib/auth/verify-session", () => ({ verifySession: jest.fn() }));

import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { GET, PUT } from "../route";
import { modStore } from "../../mod-team/route";
import {
  __resetBanSyncStore,
  __seedChannelBan,
  getBanSyncStatus,
} from "../../ban-sync/store";

const BASE = "http://localhost/api/routes-f/moderation-shared-ban-list";
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

function getReq(qs: string): NextRequest {
  return new NextRequest(`${BASE}${qs}`);
}

function putReq(body?: object): NextRequest {
  return new NextRequest(BASE, {
    method: "PUT",
    ...(body
      ? {
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }
      : {}),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  __resetBanSyncStore();
  modStore.clear();
  mockSession("mod-1");
  modStore.set("creator-1:mod-1", {
    creator_id: "creator-1",
    viewer_id: "mod-1",
    role: "mod",
    added_at: new Date().toISOString(),
  });
});

describe("GET /api/routes-f/moderation-shared-ban-list", () => {
  it("returns the session's 401 response when unauthenticated", async () => {
    verify.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await GET(getReq("?creator_id=creator-1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when creator_id is missing", async () => {
    const res = await GET(getReq(""));
    expect(res.status).toBe(400);
  });

  it("returns 403 when the caller is not a moderator of creator_id", async () => {
    mockSession("random-viewer");
    const res = await GET(getReq("?creator_id=creator-1"));
    expect(res.status).toBe(403);
  });

  it("allows the channel owner (userId === creator_id) even without a mod-team row", async () => {
    mockSession("creator-1");
    const res = await GET(getReq("?creator_id=creator-1"));
    expect(res.status).toBe(200);
  });

  it("returns subscription status for a moderator", async () => {
    const { subscribeToBans } = jest.requireActual("../../ban-sync/store");
    subscribeToBans({
      source_creator_id: "other-creator",
      target_creator_id: "creator-1",
    });
    const res = await GET(getReq("?creator_id=creator-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subscribed_to).toEqual(["other-creator"]);
    expect(body.subscribed_by).toEqual([]);
  });
});

describe("PUT /api/routes-f/moderation-shared-ban-list", () => {
  it("returns the session's 401 response when unauthenticated", async () => {
    verify.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await PUT(
      putReq({ creator_id: "creator-1", source_creator_id: "other-creator" })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON body", async () => {
    const badReq = new NextRequest(BASE, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    });
    const res = await PUT(badReq);
    expect(res.status).toBe(400);
  });

  it("returns 400 when source_creator_id is missing", async () => {
    const res = await PUT(putReq({ creator_id: "creator-1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when source_creator_id equals creator_id", async () => {
    const res = await PUT(
      putReq({ creator_id: "creator-1", source_creator_id: "creator-1" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 403 when the caller is not a moderator of creator_id", async () => {
    mockSession("random-viewer");
    const res = await PUT(
      putReq({ creator_id: "creator-1", source_creator_id: "other-creator" })
    );
    expect(res.status).toBe(403);
  });

  it("subscribes creator-1 to another channel's ban list and returns the updated status", async () => {
    const res = await PUT(
      putReq({ creator_id: "creator-1", source_creator_id: "other-creator" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subscribed_to).toEqual(["other-creator"]);

    expect(getBanSyncStatus("creator-1").subscribed_to).toEqual([
      "other-creator",
    ]);
  });

  it("copies existing bans from the source when copy_existing is true", async () => {
    __seedChannelBan("other-creator", "banned-viewer");
    const res = await PUT(
      putReq({
        creator_id: "creator-1",
        source_creator_id: "other-creator",
        copy_existing: true,
      })
    );
    expect(res.status).toBe(200);

    const { isViewerBannedOnChannel } = jest.requireActual(
      "../../ban-sync/store"
    );
    expect(isViewerBannedOnChannel("creator-1", "banned-viewer")).toBe(true);
  });

  it("is idempotent — subscribing twice does not error", async () => {
    await PUT(
      putReq({ creator_id: "creator-1", source_creator_id: "other-creator" })
    );
    const res = await PUT(
      putReq({ creator_id: "creator-1", source_creator_id: "other-creator" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subscribed_to).toEqual(["other-creator"]);
  });

  it("allows the channel owner (userId === creator_id) to subscribe without a mod-team row", async () => {
    mockSession("creator-1");
    const res = await PUT(
      putReq({ creator_id: "creator-1", source_creator_id: "other-creator" })
    );
    expect(res.status).toBe(200);
  });
});
