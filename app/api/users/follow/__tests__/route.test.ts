/**
 * @jest-environment node
 */
jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));
jest.mock("@/lib/auth/verify-session", () => ({ verifySession: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: jest.fn(() => jest.fn().mockResolvedValue(false)),
}));
jest.mock("@/lib/notifications", () => ({
  writeTemplatedNotification: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/notifications/preferences", () => ({
  shouldSendInAppNotification: jest.fn().mockResolvedValue(true),
}));
jest.mock("@/lib/routes-f/badges", () => ({
  evaluateAndAwardBadges: jest.fn().mockResolvedValue([]),
}));
jest.mock("@/lib/cache/invalidation", () => ({
  invalidateFollowCaches: jest.fn().mockResolvedValue(undefined),
}));

import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { writeTemplatedNotification } from "@/lib/notifications";
import { shouldSendInAppNotification } from "@/lib/notifications/preferences";
import { evaluateAndAwardBadges } from "@/lib/routes-f/badges";
import { POST } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const sessionMock = verifySession as jest.Mock;
const FOLLOWER_ID = "11111111-1111-4111-8111-111111111111";
const FOLLOWEE_ID = "22222222-2222-4222-8222-222222222222";

function request() {
  return new NextRequest("http://localhost/api/users/follow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ receiverUsername: "followee", action: "follow" }),
  });
}

function mockFollowQueries(insertRowCount: number) {
  sqlMock
    .mockResolvedValueOnce({ rows: [{ id: FOLLOWEE_ID }] })
    .mockResolvedValueOnce({ rows: [{ username: "follower" }] })
    .mockResolvedValueOnce({ rowCount: insertRowCount });
}

beforeEach(() => {
  jest.clearAllMocks();
  sessionMock.mockResolvedValue({ ok: true, userId: FOLLOWER_ID });
});

describe("POST /api/users/follow", () => {
  it("skips badge evaluation and notification when the follow already exists", async () => {
    mockFollowQueries(0);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(evaluateAndAwardBadges).not.toHaveBeenCalled();
    expect(shouldSendInAppNotification).not.toHaveBeenCalled();
    expect(writeTemplatedNotification).not.toHaveBeenCalled();
  });

  it("evaluates badges and writes a notification for a newly created follow", async () => {
    mockFollowQueries(1);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(evaluateAndAwardBadges).toHaveBeenCalledWith(FOLLOWEE_ID);
    expect(shouldSendInAppNotification).toHaveBeenCalledWith(
      FOLLOWEE_ID,
      "follow",
      expect.objectContaining({ sql })
    );
    expect(writeTemplatedNotification).toHaveBeenCalledWith(
      FOLLOWEE_ID,
      "follow",
      { actor: "follower" },
      expect.objectContaining({ sql }),
      "en",
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(
          new RegExp(`^follow:${FOLLOWER_ID}:${FOLLOWEE_ID}:\\d+$`)
        ),
      })
    );
  });
});
