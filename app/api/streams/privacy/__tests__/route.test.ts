jest.mock("@/lib/auth/verify-session", () => ({ verifySession: jest.fn() }));
jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { GET, POST } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const verifyMock = verifySession as jest.Mock;

describe("stream privacy owner authentication", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects unauthenticated privacy reads before querying the requested wallet", async () => {
    verifyMock.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) });
    const response = await GET(new NextRequest("https://streamfi.media/api/streams/privacy?wallet=GCREATOR"));
    expect(response.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("scopes privacy updates to the verified user even when another wallet is supplied", async () => {
    verifyMock.mockResolvedValue({ ok: true, userId: "verified-user", wallet: "GVERIFIED", privyId: null, username: "owner", email: null });
    sqlMock.mockResolvedValueOnce({ rows: [{ id: "verified-user", stream_privacy: "unlisted", share_token: "old" }] })
      .mockResolvedValueOnce({ rows: [] });
    const response = await POST(new NextRequest("https://streamfi.media/api/streams/privacy", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet: "GOTHER", privacy: "public" }),
    }));
    expect(response.status).toBe(404);
    expect(sqlMock.mock.calls[0][1]).toContain("verified-user");
  });
});