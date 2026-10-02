/**
 * @jest-environment node
 *
 * #1396 — the custodial wallet routes use KMS envelopes end to end:
 * onboarding (create) → export-key (KMS decrypt) → signing.
 */

jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));
jest.mock("@/lib/auth/verify-session", () => ({ verifySession: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => async () => false,
}));

import { randomBytes } from "crypto";
import { NextRequest } from "next/server";
import { Keypair } from "@stellar/stellar-sdk";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { FakeKms } from "@/testing/fake-kms";
import { legacyEncrypt } from "@/testing/legacy-custodial-key";
import { setKmsForTesting } from "@/lib/custodial-keys/kms";
import { POST as onboarding } from "@/app/api/auth/onboarding/route";
import { POST as exportKey } from "@/app/api/auth/export-key/route";
import { POST as regenerate } from "@/app/api/auth/regenerate-wallet/route";

const sqlMock = sql as unknown as jest.Mock;
const sessionMock = verifySession as jest.Mock;
const LEGACY_KEY = randomBytes(32).toString("hex");
const ORIGINAL_ENV = process.env;

let kms: FakeKms;
let storedKey: string | null;
let statements: Array<{ text: string; values: unknown[] }>;
let spies: jest.SpyInstance[];
let output: string[];

const req = (body: object = {}) =>
  new NextRequest("http://localhost/api/auth/x", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": "203.0.113.5" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  kms = new FakeKms();
  setKmsForTesting(kms);
  process.env = { ...ORIGINAL_ENV, STELLAR_ENCRYPTION_KEY: LEGACY_KEY };
  storedKey = null;
  statements = [];
  sessionMock.mockResolvedValue({
    ok: true,
    userId: "user-42",
    privyId: "did:privy:user-42",
    wallet: null,
    username: null,
    email: null,
  });
  sqlMock.mockImplementation(
    async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join("?");
      statements.push({ text, values });
      if (/UPDATE users/.test(text) && /encrypted_stellar_key/.test(text)) {
        storedKey = values.find(
          v => typeof v === "string" && v.startsWith("ckv2:")
        ) as string;
      }
      if (/SELECT encrypted_stellar_key/.test(text)) {
        return { rows: [{ encrypted_stellar_key: storedKey }] };
      }
      return { rows: [], rowCount: 1 };
    }
  );
  output = [];
  spies = (["log", "info", "warn", "error"] as const).map(m =>
    jest.spyOn(console, m).mockImplementation((...a: unknown[]) => {
      output.push(a.map(String).join(" "));
    })
  );
});

afterEach(() => spies.forEach(s => s.mockRestore()));
afterAll(() => {
  process.env = ORIGINAL_ENV;
  setKmsForTesting(null);
});

it("creates a KMS-enveloped wallet at onboarding and exports a key that signs for it", async () => {
  delete process.env.STELLAR_ENCRYPTION_KEY; // new wallets must not need it

  const created = await onboarding(req({ username: "newbie" }));
  expect(created.status).toBe(200);
  const { wallet } = await created.json();
  expect(storedKey).toMatch(/^ckv2:/);
  expect(kms.calls[0]).toMatchObject({
    op: "generate",
    context: { user_id: "user-42" },
  });

  const exported = await exportKey(req());
  expect(exported.status).toBe(200);
  const { secretKey } = await exported.json();
  const signer = Keypair.fromSecret(secretKey);
  expect(signer.publicKey()).toBe(wallet);
  const msg = Buffer.from("payout");
  expect(Keypair.fromPublicKey(wallet).verify(msg, signer.sign(msg))).toBe(
    true
  );
  expect(kms.calls.map(c => c.op)).toEqual(["generate", "decrypt"]);

  expect(output.join("\n")).not.toContain(secretKey);
});

it("does not create a wallet when KMS is unavailable", async () => {
  kms.fail("DependencyTimeoutException", "generate");
  const res = await onboarding(req({ username: "newbie" }));
  expect(res.status).toBe(503);
  expect(statements.some(s => /encrypted_stellar_key/.test(s.text))).toBe(
    false
  );
});

it("returns 503 (not a static-key fallback) when KMS is down during export", async () => {
  await onboarding(req({ username: "newbie" }));
  kms.fail("ThrottlingException", "decrypt");
  const res = await exportKey(req());
  expect(res.status).toBe(503);
  expect(res.headers.get("Retry-After")).toBe("30");
  expect(await res.json()).not.toHaveProperty("secretKey");
});

it("returns 500 without details when KMS denies access", async () => {
  await onboarding(req({ username: "newbie" }));
  kms.fail("AccessDeniedException", "decrypt");
  const res = await exportKey(req());
  expect(res.status).toBe(500);
  expect(await res.json()).toEqual({
    error: "Failed to decrypt key — contact support",
  });
});

it("still exports an unmigrated legacy key during the migration window", async () => {
  const kp = Keypair.random();
  storedKey = legacyEncrypt(kp.secret(), LEGACY_KEY);
  const res = await exportKey(req());
  expect((await res.json()).secretKey).toBe(kp.secret());
  expect(kms.calls).toHaveLength(0);
});

it("regenerates into a KMS envelope and drops any stale legacy backup", async () => {
  const res = await regenerate(req());
  expect(res.status).toBe(200);
  const update = statements.find(s => /UPDATE users/.test(s.text))!;
  expect(update.text).toMatch(/encrypted_stellar_key_legacy = NULL/);
  expect(storedKey).toMatch(/^ckv2:/);
});
