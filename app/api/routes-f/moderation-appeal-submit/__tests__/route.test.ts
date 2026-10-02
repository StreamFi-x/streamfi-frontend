jest.mock("@/lib/auth/verify-session", () => ({ verifySession: jest.fn() }));

import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { POST } from "../route";
import { __resetModerationAppealStore, getAppeal } from "../store";
import {
  __resetBanSyncStore,
  __seedChannelBan,
} from "../../ban-sync/store";

const BASE = "http://localhost/api/routes-f/moderation-appeal-submit";
const verify = verifySession as unknown as jest.Mock;

function req(body?: object): NextRequest {
  return new NextRequest(BASE, {
    method: "POST",
    ...(body
      ? {
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }
      : {}),
  });
}

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

beforeEach(() => {
  jest.clearAllMocks();
  __resetModerationAppealStore();
  __resetBanSyncStore();
  mockSession("viewer-1");
  __seedChannelBan("creator-1", "viewer-1");
});

describe("POST /api/routes-f/moderation-appeal-submit", () => {
  it("submits an appeal and returns 201 with a pending status", async () => {
    const res = await POST(
      req({
        creator_id: "creator-1",
        ban_id: "ban-1",
        message: "I was banned by mistake, please review.",
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({
      appeal_id: expect.any(String),
      status: "pending",
      created_at: expect.any(String),
    });

    const stored = getAppeal(body.appeal_id);
    expect(stored).toMatchObject({
      creator_id: "creator-1",
      viewer_id: "viewer-1",
      ban_id: "ban-1",
      status: "pending",
    });
  });

  it("submits an appeal without a ban_id (optional field)", async () => {
    const res = await POST(
      req({
        creator_id: "creator-1",
        message: "Please reconsider my ban.",
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    const stored = getAppeal(body.appeal_id);
    expect(stored?.ban_id).toBeNull();
  });

  it("files the appeal for the authenticated caller, ignoring any viewer_id in the body", async () => {
    const res = await POST(
      req({
        creator_id: "creator-1",
        viewer_id: "someone-else",
        message: "hi",
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    const stored = getAppeal(body.appeal_id);
    expect(stored?.viewer_id).toBe("viewer-1");
  });

  it("returns the session's 401 response when unauthenticated", async () => {
    verify.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await POST(
      req({ creator_id: "creator-1", message: "hi" })
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller is not banned on the channel", async () => {
    mockSession("viewer-2"); // not seeded as banned
    const res = await POST(
      req({ creator_id: "creator-1", message: "I was never banned." })
    );
    expect(res.status).toBe(403);
  });

  it("allows an appeal when the ban comes from a subscribed shared ban list", async () => {
    // viewer-3 is banned on source-creator, and creator-1 subscribes to it.
    __seedChannelBan("source-creator", "viewer-3");
    const { subscribeToBans } = jest.requireActual("../../ban-sync/store");
    subscribeToBans({
      source_creator_id: "source-creator",
      target_creator_id: "creator-1",
    });
    mockSession("viewer-3");

    const res = await POST(
      req({ creator_id: "creator-1", message: "Banned via shared list." })
    );
    expect(res.status).toBe(201);
  });

  it("returns 400 for invalid JSON body", async () => {
    const badReq = new NextRequest(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });

  it("returns 400 when creator_id is missing", async () => {
    const res = await POST(req({ message: "hi" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when message is missing", async () => {
    const res = await POST(req({ creator_id: "creator-1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when message is empty/whitespace", async () => {
    const res = await POST(
      req({ creator_id: "creator-1", message: "   " })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when message exceeds max length", async () => {
    const res = await POST(
      req({
        creator_id: "creator-1",
        message: "x".repeat(1001),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when creator_id equals the caller's own id", async () => {
    mockSession("creator-1");
    const res = await POST(
      req({ creator_id: "creator-1", message: "hi" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when ban_id is not a string", async () => {
    const res = await POST(
      req({
        creator_id: "creator-1",
        ban_id: 12345,
        message: "hi",
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 409 for a duplicate pending appeal from the same viewer", async () => {
    await POST(
      req({ creator_id: "creator-1", message: "First appeal." })
    );
    const res = await POST(
      req({ creator_id: "creator-1", message: "Second appeal." })
    );
    expect(res.status).toBe(409);
  });

  it("allows a new pending appeal once the prior one is a different viewer", async () => {
    await POST(
      req({ creator_id: "creator-1", message: "First appeal." })
    );

    __seedChannelBan("creator-1", "viewer-2");
    mockSession("viewer-2");
    const res = await POST(
      req({ creator_id: "creator-1", message: "Different viewer appeal." })
    );
    expect(res.status).toBe(201);
  });
});
