/**
 * @jest-environment node
 */
jest.mock("@/lib/auth/verify-session", () => ({ verifySession: jest.fn() }));
jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));
jest.mock("@/app/api/routes-f/2fa/_lib/totp", () => ({
  generateTotpSecret: jest.fn(),
  buildOtpauthUri: jest.fn(),
  encryptSecret: jest.fn(),
}));

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import {
  generateTotpSecret,
  buildOtpauthUri,
  encryptSecret,
} from "@/app/api/routes-f/2fa/_lib/totp";
import { POST } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const verify = verifySession as unknown as jest.Mock;
const generateTotpSecretMock = generateTotpSecret as jest.Mock;
const buildOtpauthUriMock = buildOtpauthUri as jest.Mock;
const encryptSecretMock = encryptSecret as jest.Mock;

function postReq(): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/auth-2fa-enable", {
    method: "POST",
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  verify.mockResolvedValue({
    ok: true,
    userId: "user-1",
    wallet: null,
    privyId: null,
    username: "alice",
    email: "alice@example.com",
  });
  generateTotpSecretMock.mockReturnValue("JBSWY3DPEHPK3PXP");
  encryptSecretMock.mockReturnValue({
    ciphertext: "enc",
    iv: "iv",
    tag: "tag",
  });
  buildOtpauthUriMock.mockReturnValue(
    "otpauth://totp/StreamFi:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=StreamFi"
  );
});

describe("POST /api/routes-f/auth-2fa-enable", () => {
  it("returns the session's 401 response when unauthenticated", async () => {
    verify.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await POST(postReq());
    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("returns 409 when 2FA is already enabled", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [{ totp_enabled: true }] });
    const res = await POST(postReq());
    expect(res.status).toBe(409);
  });

  it("generates a new secret, persists it disabled, and returns the otpauth URI", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] }); // no existing row
    sqlMock.mockResolvedValueOnce({}); // INSERT ... ON CONFLICT

    const res = await POST(postReq());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.secret).toBe("JBSWY3DPEHPK3PXP");
    expect(body.otpauthUri).toContain("otpauth://totp/");
    expect(buildOtpauthUriMock).toHaveBeenCalledWith(
      "JBSWY3DPEHPK3PXP",
      "alice@example.com"
    );
    expect(sqlMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to username, then userId, when email is missing", async () => {
    verify.mockResolvedValue({
      ok: true,
      userId: "user-1",
      wallet: null,
      privyId: null,
      username: "alice",
      email: null,
    });
    sqlMock.mockResolvedValueOnce({ rows: [] });
    sqlMock.mockResolvedValueOnce({});

    await POST(postReq());
    expect(buildOtpauthUriMock).toHaveBeenCalledWith("JBSWY3DPEHPK3PXP", "alice");
  });

  it("re-enrolls (overwrites the previous unconfirmed secret) when a disabled row already exists", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [{ totp_enabled: false }] });
    sqlMock.mockResolvedValueOnce({});

    const res = await POST(postReq());
    expect(res.status).toBe(200);
  });

  it("returns 500 when the database lookup fails", async () => {
    sqlMock.mockRejectedValueOnce(new Error("db down"));
    const res = await POST(postReq());
    expect(res.status).toBe(500);
  });

  it("returns 500 when encryption fails", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] });
    encryptSecretMock.mockImplementation(() => {
      throw new Error("Missing encryption key env var");
    });
    const res = await POST(postReq());
    expect(res.status).toBe(500);
  });
});
