/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { PATCH } from "../route";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));
jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

const mockSql = jest.mocked(sql);
const mockVerifySession = verifySession as jest.Mock;
const USER_ID = "c0110000-0000-4000-8000-000000000001";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/users/preferences", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/users/preferences language validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifySession.mockResolvedValue({ ok: true, userId: USER_ID });
    mockSql.mockResolvedValue({
      rows: [{ language: "fr" }],
      command: "UPDATE",
      rowCount: 1,
      oid: 0,
      fields: [],
    });
  });

  it("accepts a supported language code", async () => {
    const response = await PATCH(makeRequest({ language: "fr" }));

    expect(response.status).toBe(200);
    expect(mockSql).toHaveBeenCalledTimes(2);
    expect(mockSql.mock.calls[1]).toContain("fr");
  });

  it("rejects display names and unsupported language codes", async () => {
    const response = await PATCH(makeRequest({ language: "French" }));

    expect(response.status).toBe(400);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("rejects retired notification fields instead of silently discarding them", async () => {
    const response = await PATCH(makeRequest({ notify_tips: false }));

    expect(response.status).toBe(400);
    expect(mockSql).not.toHaveBeenCalled();
  });
});
