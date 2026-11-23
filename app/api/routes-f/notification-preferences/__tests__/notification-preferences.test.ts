/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from "next/server";
import { GET, PUT } from "../route";
import { verifySession } from "@/lib/auth/verify-session";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/notifications/preferences";

jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));
jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));
jest.mock("@/lib/notifications/preferences", () => ({
  getNotificationPreferences: jest.fn(),
  updateNotificationPreferences: jest.fn(),
}));

const USER_ID = "c0110000-0000-4000-8000-000000000001";
const OTHER_USER_ID = "c0110000-0000-4000-8000-000000000002";
const BASE_URL = "http://localhost/api/routes-f/notification-preferences";
const mockVerifySession = verifySession as jest.Mock;
const mockGetPreferences = getNotificationPreferences as jest.Mock;
const mockUpdatePreferences = updateNotificationPreferences as jest.Mock;

function makeGet(url = BASE_URL) {
  return new NextRequest(url, { method: "GET" });
}

function makePut(body: unknown) {
  return new NextRequest(BASE_URL, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/notification-preferences", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifySession.mockResolvedValue({ ok: true, userId: USER_ID });
  });

  it("requires an authenticated session for reads", async () => {
    mockVerifySession.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await GET(makeGet());

    expect(response.status).toBe(401);
    expect(mockGetPreferences).not.toHaveBeenCalled();
  });

  it("scopes reads to the authenticated user and rejects caller-selected IDs", async () => {
    const response = await GET(makeGet(`${BASE_URL}?user_id=${OTHER_USER_ID}`));

    expect(response.status).toBe(400);
    expect(mockGetPreferences).not.toHaveBeenCalled();
  });

  it("returns the authenticated user's persisted preferences", async () => {
    const preferences = { user_id: USER_ID, notify_live: false };
    mockGetPreferences.mockResolvedValue(preferences);

    const response = await GET(makeGet());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(preferences);
    expect(mockGetPreferences).toHaveBeenCalledWith(USER_ID);
  });

  it("writes only to the authenticated user's preference record", async () => {
    const preferences = { user_id: USER_ID, notify_live: false };
    mockUpdatePreferences.mockResolvedValue(preferences);

    const response = await PUT(makePut({ notify_live: false }));

    expect(response.status).toBe(200);
    expect(mockUpdatePreferences).toHaveBeenCalledWith(
      USER_ID,
      { notify_live: false },
      expect.any(Function)
    );
  });

  it("rejects caller-supplied user IDs", async () => {
    const response = await PUT(
      makePut({ user_id: OTHER_USER_ID, notify_live: false })
    );

    expect(response.status).toBe(400);
    expect(mockUpdatePreferences).not.toHaveBeenCalled();
  });

  it("surfaces database failures instead of returning a success-shaped default", async () => {
    mockUpdatePreferences.mockRejectedValue(new Error("database unavailable"));

    const response = await PUT(makePut({ notify_live: false }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Failed to update notification preferences",
    });
  });
});
