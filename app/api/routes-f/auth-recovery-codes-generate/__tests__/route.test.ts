/**
 * @jest-environment node
 */
jest.mock("@/lib/auth/verify-session", () => ({ verifySession: jest.fn() }));
jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));
jest.mock("@/app/api/routes-f/2fa/_lib/totp", () => ({
  decryptSecret: jest.fn(),
  verifyTotpToken: jest.fn(),
  generateBackupCodes: jest.fn(),
}));

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import {
  decryptSecret,
  verifyTotpToken,
  generateBackupCodes,
} from "@/app/api/routes-f/2fa/_lib/totp";
import { POST } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const verify = verifySession as unknown as jest.Mock;
const decryptSecretMock = decryptSecret as jest.Mock;
const verifyTotpTokenMock = verifyTotpToken as jest.Mock;
const generateBackupCodesMock = generateBackupCodes as jest.Mock;

const TEN_CODES = Array.from({ length: 10 }, (_, i) => `CODE${i}-XXXXX`);

function postReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/auth-recovery-codes-generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  verify.mockResolvedValue({
    ok: true,
    userId: "user-1",
    wallet: null,
    privyId: null,
    username: null,
    email: null,
  });
  decryptSecretMock.mockReturnValue("decrypted-secret");
  generateBackupCodesMock.mockReturnValue(TEN_CODES);
});

describe("POST /api/routes-f/auth-recovery-codes-generate", () => {
  it("returns the session's 401 response when unauthenticated", async () => {
    verify.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await POST(postReq({ token: "123456" }));
    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the token is missing or malformed", async () => {
    const res = await POST(postReq({ token: "abc" }));
    expect(res.status).toBe(400);
  });

  it("returns 409 when 2FA is not enabled", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [{ totp_enabled: false }] });
    const res = await POST(postReq({ token: "123456" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("must be enabled");
  });

  it("returns 409 when there is no user_two_factor row at all", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] });
    const res = await POST(postReq({ token: "123456" }));
    expect(res.status).toBe(409);
  });

  it("returns 400 for an invalid or expired TOTP code", async () => {
    sqlMock.mockResolvedValueOnce({
      rows: [{ totp_enabled: true, totp_secret_ciphertext: "x", totp_secret_iv: "y", totp_secret_tag: "z" }],
    });
    verifyTotpTokenMock.mockReturnValue(false);

    const res = await POST(postReq({ token: "000000" }));
    expect(res.status).toBe(400);
  });

  it("generates exactly 10 recovery codes and overwrites the stored hashes on a valid token", async () => {
    sqlMock.mockResolvedValueOnce({
      rows: [{ totp_enabled: true, totp_secret_ciphertext: "x", totp_secret_iv: "y", totp_secret_tag: "z" }],
    });
    verifyTotpTokenMock.mockReturnValue(true);
    sqlMock.mockResolvedValueOnce({}); // UPDATE

    const res = await POST(postReq({ token: "123456" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recoveryCodes).toEqual(TEN_CODES);
    expect(generateBackupCodesMock).toHaveBeenCalledWith(10);
    expect(sqlMock).toHaveBeenCalledTimes(2);
  });

  it("returns 500 when the database lookup fails", async () => {
    sqlMock.mockRejectedValueOnce(new Error("db down"));
    const res = await POST(postReq({ token: "123456" }));
    expect(res.status).toBe(500);
  });

  it("returns 500 when the update fails after a valid token", async () => {
    sqlMock.mockResolvedValueOnce({
      rows: [{ totp_enabled: true, totp_secret_ciphertext: "x", totp_secret_iv: "y", totp_secret_tag: "z" }],
    });
    verifyTotpTokenMock.mockReturnValue(true);
    sqlMock.mockRejectedValueOnce(new Error("db down"));

    const res = await POST(postReq({ token: "123456" }));
    expect(res.status).toBe(500);
  });
});
