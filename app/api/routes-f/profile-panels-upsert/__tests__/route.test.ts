/**
 * @jest-environment node
 */
jest.mock("@vercel/postgres", () => {
  const clientSqlMock = jest.fn();
  const clientConnectMock = jest.fn().mockResolvedValue(undefined);
  const clientEndMock = jest.fn().mockResolvedValue(undefined);
  const createClientMock = jest.fn(() => ({
    connect: clientConnectMock,
    sql: clientSqlMock,
    end: clientEndMock,
  }));
  return {
    createClient: createClientMock,
    __mocks: { clientSqlMock, clientConnectMock, clientEndMock, createClientMock },
  };
});

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

jest.mock("../_lib/db", () => ({
  ensureProfilePanelsSchema: jest.fn().mockResolvedValue(undefined),
}));

import { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { PUT } from "../route";

const { clientSqlMock, clientConnectMock, clientEndMock } = jest.requireMock(
  "@vercel/postgres"
).__mocks as {
  clientSqlMock: jest.Mock;
  clientConnectMock: jest.Mock;
  clientEndMock: jest.Mock;
};
const verifySessionMock = verifySession as jest.Mock;
const CHANNEL_ID = "550e8400-e29b-41d4-a716-446655440000";

function makeRequest(body?: object) {
  return new NextRequest("http://localhost/api/routes-f/profile-panels-upsert", {
    method: "PUT",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function mockSession() {
  verifySessionMock.mockResolvedValue({
    ok: true,
    userId: CHANNEL_ID,
    wallet: null,
    privyId: "did:privy:abc",
    username: "creator",
    email: "creator@example.com",
  });
}

describe("routes-f profile-panels-upsert", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    clientConnectMock.mockResolvedValue(undefined);
    clientEndMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns 401 for unauthenticated requests", async () => {
    verifySessionMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    });

    const res = await PUT(makeRequest({ panels: [] }));

    expect(res.status).toBe(401);
  });

  it("returns 400 when more than 12 panels are supplied", async () => {
    mockSession();

    const panels = Array.from({ length: 13 }, (_, i) => ({
      title: `Panel ${i}`,
      body: "content",
    }));

    const res = await PUT(makeRequest({ panels }));

    expect(res.status).toBe(400);
  });

  it("returns 400 when a panel is missing a required field", async () => {
    mockSession();

    const res = await PUT(
      makeRequest({ panels: [{ title: "", body: "content" }] })
    );

    expect(res.status).toBe(400);
  });

  it("replaces the panel set and returns the new ordered panels", async () => {
    mockSession();

    clientSqlMock
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce(undefined) // DELETE
      .mockResolvedValueOnce({
        rows: [
          {
            id: "panel-1",
            title: "About",
            body: "Welcome",
            image_url: null,
            position: 0,
          },
        ],
      }) // INSERT #1
      .mockResolvedValueOnce({
        rows: [
          {
            id: "panel-2",
            title: "Schedule",
            body: "Every day at 6pm",
            image_url: "https://example.com/schedule.png",
            position: 1,
          },
        ],
      }) // INSERT #2
      .mockResolvedValueOnce(undefined); // COMMIT

    const res = await PUT(
      makeRequest({
        panels: [
          { title: "About", body: "Welcome" },
          {
            title: "Schedule",
            body: "Every day at 6pm",
            image_url: "https://example.com/schedule.png",
          },
        ],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.panels).toHaveLength(2);
    expect(body.panels[1].title).toBe("Schedule");
    expect(clientConnectMock).toHaveBeenCalledTimes(1);
    expect(clientEndMock).toHaveBeenCalledTimes(1);
  });

  it("rolls back and returns 500 when an insert fails mid-transaction", async () => {
    mockSession();

    clientSqlMock
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce(undefined) // DELETE
      .mockRejectedValueOnce(new Error("db down")) // INSERT #1 fails
      .mockResolvedValueOnce(undefined); // ROLLBACK

    const res = await PUT(
      makeRequest({ panels: [{ title: "About", body: "Welcome" }] })
    );

    expect(res.status).toBe(500);
    // BEGIN, DELETE, failed INSERT, then ROLLBACK — 4 calls total.
    expect(clientSqlMock).toHaveBeenCalledTimes(4);
    const rollbackCallArgs = clientSqlMock.mock.calls[3][0];
    expect(rollbackCallArgs.join("")).toContain("ROLLBACK");
    expect(clientEndMock).toHaveBeenCalledTimes(1);
  });
});
