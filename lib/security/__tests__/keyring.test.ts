import { createCipheriv, randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret } from "@/lib/security/encrypted-secrets";
import { loadKeyring } from "@/lib/security/keyring";
import { signToken, verifyToken } from "@/lib/auth/sign-token";

describe("versioned encryption keyring", () => {
  const old = process.env.STELLAR_ENCRYPTION_KEYRING_JSON;
  const legacy = process.env.STELLAR_ENCRYPTION_KEY;
  const keyA = "11".repeat(32);
  const keyB = "22".repeat(32);

  beforeEach(() => {
    process.env.STELLAR_ENCRYPTION_KEYRING_JSON = JSON.stringify({ activeKid: "new", keys: { new: keyB, old: keyA } });
    delete process.env.STELLAR_ENCRYPTION_KEY;
  });

  afterAll(() => {
    if (old === undefined) {delete process.env.STELLAR_ENCRYPTION_KEYRING_JSON;} else {process.env.STELLAR_ENCRYPTION_KEYRING_JSON = old;}
    if (legacy === undefined) {delete process.env.STELLAR_ENCRYPTION_KEY;} else {process.env.STELLAR_ENCRYPTION_KEY = legacy;}
  });

  it("encrypts using the active key ID and decrypts it", () => {
    const envelope = encryptSecret("S-private-key");
    expect(envelope.startsWith("v1:new:")).toBe(true);
    expect(decryptSecret(envelope)).toBe("S-private-key");
  });

  it("decrypts the legacy three-field AES-GCM format with an overlap key", () => {
    const key = Buffer.from(keyA, "hex");
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update("S-legacy-key"), cipher.final()]);
    const legacyEnvelope = [iv.toString("hex"), cipher.getAuthTag().toString("hex"), ciphertext.toString("hex")].join(":");
    expect(decryptSecret(legacyEnvelope)).toBe("S-legacy-key");
  });

  it("requires the active ID to resolve to a configured key", () => {
    expect(() => loadKeyring("TEST_RING", "TEST_LEGACY")).toThrow();
  });

  it("verifies a session signed by a previous key ID during rotation overlap", () => {
    const overlap = loadKeyring("STELLAR_ENCRYPTION_KEYRING_JSON", "STELLAR_ENCRYPTION_KEY", "hex");
    const previous = { activeKid: "old", keys: overlap.keys };
    const token = signToken({ userId: "u1", exp: Math.floor(Date.now() / 1000) + 60 }, previous);
    expect(verifyToken<{ userId: string }>(token, overlap)?.userId).toBe("u1");
  });
});