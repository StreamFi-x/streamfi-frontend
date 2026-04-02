jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
  db: {
    connect: jest.fn(),
  },
}));

jest.mock("@/lib/notification-email", () => ({
  sendTipReceivedNotificationEmail: jest.fn(),
}));

import { normalizeNotificationPreferences } from "@/lib/notifications";

describe("normalizeNotificationPreferences", () => {
  it("falls back to defaults when the payload is invalid", () => {
    expect(normalizeNotificationPreferences(null, false)).toEqual({
      newFollower: true,
      tipReceived: true,
      streamLive: true,
      recordingReady: true,
      emailNotifications: false,
    });
  });

  it("merges explicit boolean values from the stored preferences", () => {
    expect(
      normalizeNotificationPreferences({
        newFollower: false,
        tipReceived: false,
        streamLive: true,
        recordingReady: false,
        emailNotifications: true,
      })
    ).toEqual({
      newFollower: false,
      tipReceived: false,
      streamLive: true,
      recordingReady: false,
      emailNotifications: true,
    });
  });
});
