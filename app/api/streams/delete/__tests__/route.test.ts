/**
 * @jest-environment node
 */
jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json", ...init?.headers },
      }),
  },
}));

jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}));

jest.mock("@/lib/mux/server", () => ({
  deleteMuxStream: jest.fn(),
}));

jest.mock("@/lib/cache/invalidation", () => ({
  invalidateUserCaches: jest.fn(),
}));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

jest.mock("@/lib/db/replica", () => ({
  markRecentWrite: jest.fn((res: Response) => res),
}));

import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { deleteMuxStream } from "@/lib/mux/server";
import { invalidateUserCaches } from "@/lib/cache/invalidation";
import { verifySession } from "@/lib/auth/verify-session";
import { markRecentWrite } from "@/lib/db/replica";
import { DELETE, GET } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const deleteMuxStreamMock = deleteMuxStream as jest.Mock;
const invalidateCachesMock = invalidateUserCaches as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;
const markRecentWriteMock = markRecentWrite as jest.Mock;

function makeDeleteRequest(search = "", body?: unknown) {
  return new Request(`http://localhost/api/streams/delete${search}`, {
    method: "DELETE",
    ...(body !== undefined
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  }) as unknown as NextRequest;
}

describe("/api/streams/delete (#1722, #1717)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "user-1",
      wallet: "GOWNER0000000000000000000000000000000000000000000000000",
      privyId: null,
      username: "owner",
      email: null,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("no longer exposes the legacy streams/delete-get route", () => {
    expect(() => require("../../delete-get/route")).toThrow();
  });

  it("rejects GET requests with 405 and Allow: DELETE without touching DB or Mux", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("DELETE");
    expect(body).toEqual({
      success: false,
      error: "Method not allowed",
      code: "METHOD_NOT_ALLOWED",
    });
    expect(sqlMock).not.toHaveBeenCalled();
    expect(deleteMuxStreamMock).not.toHaveBeenCalled();
  });

  it("returns 401 when caller is unauthenticated", async () => {
    verifySessionMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });

    const res = await DELETE(makeDeleteRequest());
    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("returns 404 when user is not found", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const res = await DELETE(makeDeleteRequest());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({
      success: false,
      error: "User not found",
      code: "NOT_FOUND",
    });
  });

  it("returns 404 when user has no stream configured", async () => {
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: "user-1",
          username: "owner",
          mux_stream_id: null,
          is_live: false,
        },
      ],
    });

    const res = await DELETE(makeDeleteRequest());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({
      success: false,
      error: "No stream found to delete",
      code: "NOT_FOUND",
    });
    expect(deleteMuxStreamMock).not.toHaveBeenCalled();
  });

  it("returns 409 conflict when stream is live without force flag", async () => {
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: "user-1",
          username: "owner",
          mux_stream_id: "mux-1",
          is_live: true,
        },
      ],
    });

    const res = await DELETE(makeDeleteRequest());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.code).toBe("CONFLICT");
    expect(deleteMuxStreamMock).not.toHaveBeenCalled();
  });

  it("force-deletes a live stream via DELETE ?force=true", async () => {
    sqlMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: "user-1",
            username: "owner",
            mux_stream_id: "mux-1",
            is_live: true,
          },
        ],
      })
      .mockResolvedValue({ rows: [] });

    const res = await DELETE(makeDeleteRequest("?force=true"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.forced).toBe(true);
    expect(body.data.actions).toContain("Stopped live stream");
    expect(body.message).toBe("Stream force deleted successfully");
    expect(deleteMuxStreamMock).toHaveBeenCalledWith("mux-1");
    expect(invalidateCachesMock).toHaveBeenCalledWith({ id: "user-1" });
    expect(markRecentWriteMock).toHaveBeenCalledTimes(1);
  });

  it("force-deletes a live stream via DELETE JSON body { force: true }", async () => {
    sqlMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: "user-1",
            username: "owner",
            mux_stream_id: "mux-2",
            is_live: true,
          },
        ],
      })
      .mockResolvedValue({ rows: [] });

    const res = await DELETE(makeDeleteRequest("", { force: true }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.forced).toBe(true);
    expect(deleteMuxStreamMock).toHaveBeenCalledWith("mux-2");
  });

  it("deletes an offline stream cleanly and still cleans DB if Mux fails", async () => {
    sqlMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: "user-1",
            username: "owner",
            mux_stream_id: "mux-3",
            is_live: false,
          },
        ],
      })
      .mockResolvedValue({ rows: [] });
    deleteMuxStreamMock.mockRejectedValueOnce(new Error("Mux 502"));

    const res = await DELETE(makeDeleteRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.forced).toBe(false);
    expect(body.message).toBe("Stream deleted successfully");
    expect(invalidateCachesMock).toHaveBeenCalledWith({ id: "user-1" });
  });

  it("returns 500 canonical error when database fails", async () => {
    sqlMock.mockRejectedValueOnce(new Error("DB offline"));

    const res = await DELETE(makeDeleteRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({
      success: false,
      error: "Failed to delete stream",
      code: "INTERNAL_ERROR",
    });
  });
});
