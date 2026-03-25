jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

jest.mock("@/lib/notifications", () => ({
  listNotifications: jest.fn(),
  markNotificationAsRead: jest.fn(),
  markAllNotificationsAsRead: jest.fn(),
  deleteNotification: jest.fn(),
  getNotificationPreferences: jest.fn(),
  updateNotificationPreferences: jest.fn(),
}));

import { GET as getNotifications } from "../route";
import {
  PATCH as patchNotification,
  DELETE as deleteNotificationRoute,
} from "../[id]/route";
import { PATCH as patchReadAll } from "../read-all/route";
import {
  GET as getPreferences,
  PUT as putPreferences,
} from "../preferences/route";
import { verifySession } from "@/lib/auth/verify-session";
import {
  deleteNotification,
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  updateNotificationPreferences,
} from "@/lib/notifications";

const verifySessionMock = verifySession as jest.Mock;
const listNotificationsMock = listNotifications as jest.Mock;
const markNotificationAsReadMock = markNotificationAsRead as jest.Mock;
const markAllNotificationsAsReadMock = markAllNotificationsAsRead as jest.Mock;
const deleteNotificationMock = deleteNotification as jest.Mock;
const getNotificationPreferencesMock = getNotificationPreferences as jest.Mock;
const updateNotificationPreferencesMock =
  updateNotificationPreferences as jest.Mock;

const makeRequest = (method: string, path: string, body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;

describe("notifications routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists notifications for the authenticated user", async () => {
    verifySessionMock.mockResolvedValue({ ok: true, userId: "user-1" });
    listNotificationsMock.mockResolvedValue({
      notifications: [{ id: "n-1", title: "Test notification" }],
      unreadCount: 2,
    });

    const response = await getNotifications(
      makeRequest("GET", "/api/users/notifications?limit=5")
    );

    expect(response.status).toBe(200);
    expect(listNotificationsMock).toHaveBeenCalledWith("user-1", 5);
    await expect(response.json()).resolves.toEqual({
      notifications: [{ id: "n-1", title: "Test notification" }],
      unreadCount: 2,
    });
  });

  it("rejects invalid notification list query params", async () => {
    verifySessionMock.mockResolvedValue({ ok: true, userId: "user-1" });

    const response = await getNotifications(
      makeRequest("GET", "/api/users/notifications?limit=500")
    );

    expect(response.status).toBe(400);
  });

  it("marks a single notification as read", async () => {
    verifySessionMock.mockResolvedValue({ ok: true, userId: "user-1" });
    markNotificationAsReadMock.mockResolvedValue({ id: "n-1", read: true });

    const response = await patchNotification(
      makeRequest(
        "PATCH",
        "/api/users/notifications/11111111-1111-1111-1111-111111111111"
      ),
      {
        params: Promise.resolve({
          id: "11111111-1111-1111-1111-111111111111",
        }),
      }
    );

    expect(response.status).toBe(200);
    expect(markNotificationAsReadMock).toHaveBeenCalledWith(
      "user-1",
      "11111111-1111-1111-1111-111111111111"
    );
  });

  it("marks all notifications as read", async () => {
    verifySessionMock.mockResolvedValue({ ok: true, userId: "user-1" });
    markAllNotificationsAsReadMock.mockResolvedValue(4);

    const response = await patchReadAll(
      makeRequest("PATCH", "/api/users/notifications/read-all")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ updatedCount: 4 });
  });

  it("deletes a notification", async () => {
    verifySessionMock.mockResolvedValue({ ok: true, userId: "user-1" });
    deleteNotificationMock.mockResolvedValue(true);

    const response = await deleteNotificationRoute(
      makeRequest(
        "DELETE",
        "/api/users/notifications/11111111-1111-1111-1111-111111111111"
      ),
      {
        params: Promise.resolve({
          id: "11111111-1111-1111-1111-111111111111",
        }),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deleted: true });
  });

  it("returns notification preferences for the authenticated user", async () => {
    verifySessionMock.mockResolvedValue({ ok: true, userId: "user-1" });
    getNotificationPreferencesMock.mockResolvedValue({
      newFollower: true,
      tipReceived: true,
      streamLive: false,
      recordingReady: true,
      emailNotifications: false,
    });

    const response = await getPreferences(
      makeRequest("GET", "/api/users/notifications/preferences")
    );

    expect(response.status).toBe(200);
    expect(getNotificationPreferencesMock).toHaveBeenCalledWith("user-1");
  });

  it("updates notification preferences", async () => {
    verifySessionMock.mockResolvedValue({ ok: true, userId: "user-1" });
    updateNotificationPreferencesMock.mockResolvedValue({
      newFollower: false,
      tipReceived: true,
      streamLive: true,
      recordingReady: true,
      emailNotifications: true,
    });

    const response = await putPreferences(
      makeRequest("PUT", "/api/users/notifications/preferences", {
        newFollower: false,
      })
    );

    expect(response.status).toBe(200);
    expect(updateNotificationPreferencesMock).toHaveBeenCalledWith("user-1", {
      newFollower: false,
    });
  });
});
