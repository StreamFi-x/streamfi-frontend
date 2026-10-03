jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

import { authenticator } from "otplib";
import { sql } from "@vercel/postgres";
import { encryptSecret } from "@/lib/security/encrypted-secrets";
import { verifyTotp } from "@/lib/security/step-up";

const sqlMock = sql as unknown as jest.Mock;
const previousKeyring = process.env.TOTP_ENCRYPTION_KEYRING_JSON;

describe("TOTP verification", () => {
  beforeAll(() => {
    process.env.TOTP_ENCRYPTION_KEYRING_JSON = JSON.stringify({ activeKid: "totp-v1", keys: { "totp-v1": "33".repeat(32) } });
  });
  afterAll(() => {
    if (previousKeyring === undefined) {delete process.env.TOTP_ENCRYPTION_KEYRING_JSON;}
    else {process.env.TOTP_ENCRYPTION_KEYRING_JSON = previousKeyring;}
  });
  beforeEach(() => jest.clearAllMocks());

  it("accepts a current authenticator code using the encrypted stored seed", async () => {
    const secret = authenticator.generateSecret();
    sqlMock.mockResolvedValue({ rows: [{ totp_secret_enc: encryptSecret(secret, "TOTP") }] });
    await expect(verifyTotp("user-1", authenticator.generate(secret))).resolves.toBe(true);
  });

  it("rejects an invalid code", async () => {
    sqlMock.mockResolvedValue({ rows: [{ totp_secret_enc: encryptSecret(authenticator.generateSecret(), "TOTP") }] });
    await expect(verifyTotp("user-1", "000000")).resolves.toBe(false);
  });
});