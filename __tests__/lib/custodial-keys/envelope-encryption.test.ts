/**
 * @jest-environment node
 *
 * #1396 — KMS envelope encryption for custodial Stellar keys.
 */

import { randomBytes } from "crypto";
import { Keypair } from "@stellar/stellar-sdk";
import { FakeKms } from "@/testing/fake-kms";
import { legacyEncrypt as encryptLegacy } from "@/testing/legacy-custodial-key";
import {
  ENVELOPE_PREFIX,
  decryptCustodialSecret,
  detectCustodialKeyFormat,
  encryptCustodialSecret,
} from "@/lib/custodial-keys";
import { CustodialKeyError } from "@/lib/custodial-keys/errors";
import { AwsKms, getKms, setKmsForTesting } from "@/lib/custodial-keys/kms";

const LEGACY_KEY_HEX = randomBytes(32).toString("hex");
const ORIGINAL_ENV = process.env;

const legacyEncrypt = (plaintext: string) =>
  encryptLegacy(plaintext, LEGACY_KEY_HEX);

function decodeEnvelope(stored: string) {
  return JSON.parse(
    Buffer.from(stored.slice(ENVELOPE_PREFIX.length), "base64url").toString()
  );
}

function reencode(env: object) {
  return (
    ENVELOPE_PREFIX + Buffer.from(JSON.stringify(env)).toString("base64url")
  );
}

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toBeInstanceOf(CustodialKeyError);
  await expect(p).rejects.toMatchObject({ code });
}

let kms: FakeKms;
let output: string[];
let spies: jest.SpyInstance[];

beforeEach(() => {
  kms = new FakeKms();
  setKmsForTesting(kms);
  process.env = { ...ORIGINAL_ENV, STELLAR_ENCRYPTION_KEY: LEGACY_KEY_HEX };
  output = [];
  spies = (["log", "info", "warn", "error", "debug"] as const).map(m =>
    jest.spyOn(console, m).mockImplementation((...args: unknown[]) => {
      output.push(args.map(String).join(" "));
    })
  );
});

afterEach(() => spies.forEach(s => s.mockRestore()));
afterAll(() => {
  process.env = ORIGINAL_ENV;
  setKmsForTesting(null);
});

describe("new custodial wallets", () => {
  it("envelope-encrypts, decrypts through KMS, and the key still signs", async () => {
    const keypair = Keypair.random();
    const stored = await encryptCustodialSecret("user-1", keypair.secret());

    expect(detectCustodialKeyFormat(stored)).toBe("kms_envelope_v2");
    const env = decodeEnvelope(stored);
    expect(env).toMatchObject({
      v: 2,
      alg: "AES-256-GCM",
      kms: "aws-kms",
      kid: kms.activeKeyId,
    });
    expect(stored).not.toContain(keypair.secret());

    const secret = await decryptCustodialSecret("user-1", stored);
    const signer = Keypair.fromSecret(secret);
    const payload = Buffer.from("stellar tx hash");
    expect(signer.publicKey()).toBe(keypair.publicKey());
    expect(keypair.verify(payload, signer.sign(payload))).toBe(true);

    expect(kms.calls.map(c => c.op)).toEqual(["generate", "decrypt"]);
    expect(kms.calls[1].context).toEqual({
      purpose: "streamfi-custodial-stellar-key",
      user_id: "user-1",
    });
  });

  it("uses a distinct data key per wallet and never uses the static key", async () => {
    delete process.env.STELLAR_ENCRYPTION_KEY;
    const a = decodeEnvelope(
      await encryptCustodialSecret("u", Keypair.random().secret())
    );
    const b = decodeEnvelope(
      await encryptCustodialSecret("u", Keypair.random().secret())
    );
    expect(a.edk).not.toBe(b.edk);
    expect(a.iv).not.toBe(b.iv);
  });

  it("zeroes the plaintext data key after use", async () => {
    const stored = await encryptCustodialSecret("u", Keypair.random().secret());
    await decryptCustodialSecret("u", stored);
    expect(kms.issued).toHaveLength(1);
    expect(kms.issued[0].every(b => b === 0)).toBe(true);
  });

  it("binds the envelope to its owner", async () => {
    const stored = await encryptCustodialSecret(
      "owner",
      Keypair.random().secret()
    );
    await expectCode(
      decryptCustodialSecret("attacker", stored),
      "KMS_INVALID_CIPHERTEXT"
    );
  });
});

describe("KMS failures never fall back to the static key", () => {
  it.each([
    ["AccessDeniedException", "KMS_ACCESS_DENIED", false],
    ["DisabledException", "KMS_KEY_UNAVAILABLE", false],
    ["KMSInvalidStateException", "KMS_KEY_UNAVAILABLE", false],
    ["ThrottlingException", "KMS_THROTTLED", true],
    ["DependencyTimeoutException", "KMS_UNAVAILABLE", true],
    ["TimeoutError", "KMS_UNAVAILABLE", true],
  ])("%s → %s", async (awsName, code, transient) => {
    const stored = await encryptCustodialSecret("u", Keypair.random().secret());
    kms.fail(awsName, "decrypt");
    const attempt = decryptCustodialSecret("u", stored);
    await expectCode(attempt, code);
    await attempt.catch((e: CustodialKeyError) =>
      expect(e.transient).toBe(transient)
    );

    kms.fail(awsName, "generate");
    await expectCode(
      encryptCustodialSecret("u", Keypair.random().secret()),
      code
    );
  });

  it("rejects an envelope pinned to a different KMS key", async () => {
    const stored = await encryptCustodialSecret("u", Keypair.random().secret());
    kms.addKey("arn:aws:kms:eu-west-1:111122223333:key/other");
    const env = decodeEnvelope(stored);
    await expectCode(
      decryptCustodialSecret(
        "u",
        reencode({
          ...env,
          kid: "arn:aws:kms:eu-west-1:111122223333:key/other",
        })
      ),
      "KMS_WRONG_KEY"
    );
  });

  it("fails closed when KMS is not configured", async () => {
    setKmsForTesting(null);
    delete process.env.CUSTODIAL_KEY_KMS_KEY_ID;
    expect(() => getKms()).toThrow(CustodialKeyError);
    await expectCode(encryptCustodialSecret("u", "S..."), "KMS_NOT_CONFIGURED");
  });
});

describe("tampering and corruption", () => {
  let env: Record<string, string | number>;
  beforeEach(async () => {
    env = decodeEnvelope(
      await encryptCustodialSecret("u", Keypair.random().secret())
    );
  });

  const flip = (b64: string) => {
    const buf = Buffer.from(b64, "base64url");
    buf[buf.length - 1] ^= 0x01;
    return buf.toString("base64url");
  };

  it("detects a corrupted ciphertext (GCM authentication)", async () => {
    await expectCode(
      decryptCustodialSecret(
        "u",
        reencode({ ...env, ct: flip(env.ct as string) })
      ),
      "ENVELOPE_AUTH_FAILED"
    );
  });

  it("detects a corrupted auth tag", async () => {
    await expectCode(
      decryptCustodialSecret(
        "u",
        reencode({ ...env, tag: flip(env.tag as string) })
      ),
      "ENVELOPE_AUTH_FAILED"
    );
  });

  it("detects a corrupted encrypted data key", async () => {
    await expectCode(
      decryptCustodialSecret(
        "u",
        reencode({ ...env, edk: flip(env.edk as string) })
      ),
      "KMS_INVALID_CIPHERTEXT"
    );
  });

  it("rejects a truncated auth tag instead of accepting a weaker check", async () => {
    const short = Buffer.from(env.tag as string, "base64url")
      .subarray(0, 4)
      .toString("base64url");
    await expectCode(
      decryptCustodialSecret("u", reencode({ ...env, tag: short })),
      "ENVELOPE_INVALID"
    );
  });

  it("rejects malformed and unsupported envelopes", async () => {
    await expectCode(
      decryptCustodialSecret("u", `${ENVELOPE_PREFIX}not-json`),
      "ENVELOPE_INVALID"
    );
    await expectCode(
      decryptCustodialSecret("u", reencode({ ...env, v: 3 })),
      "ENVELOPE_INVALID"
    );
    await expectCode(
      decryptCustodialSecret("u", "totally-unknown"),
      "UNKNOWN_FORMAT"
    );
  });
});

describe("legacy records", () => {
  it("detects the legacy format by its explicit shape, not by guessing", () => {
    expect(detectCustodialKeyFormat(legacyEncrypt("x"))).toBe("legacy_v1");
    expect(detectCustodialKeyFormat("a:b:c")).toBe("unknown");
  });

  it("still decrypts unmigrated rows while the legacy key is configured", async () => {
    const secret = Keypair.random().secret();
    await expect(
      decryptCustodialSecret("u", legacyEncrypt(secret))
    ).resolves.toBe(secret);
    expect(kms.calls).toHaveLength(0);
  });

  it("fails closed once the legacy key is retired", async () => {
    const stored = legacyEncrypt(Keypair.random().secret());
    delete process.env.STELLAR_ENCRYPTION_KEY;
    await expectCode(
      decryptCustodialSecret("u", stored),
      "LEGACY_KEY_UNAVAILABLE"
    );
  });

  it("detects legacy tampering", async () => {
    const [iv, tag, ct] = legacyEncrypt("SECRET").split(":");
    await expectCode(
      decryptCustodialSecret(
        "u",
        [iv, tag, ct.replace(/.$/, c => (c === "0" ? "1" : "0"))].join(":")
      ),
      "LEGACY_AUTH_FAILED"
    );
  });
});

describe("no plaintext leakage", () => {
  it("never writes the secret to logs or error messages", async () => {
    const secret = Keypair.random().secret();
    const stored = await encryptCustodialSecret("u", secret);
    await decryptCustodialSecret("u", stored);
    kms.fail("AccessDeniedException", "decrypt");
    const err = await decryptCustodialSecret("u", stored).catch(e => e);
    expect(String(err.message)).not.toContain(secret);
    expect(output.join("\n")).not.toContain(secret);
    expect(output.join("\n")).toContain("custodial_key_kms_decrypt");
  });
});

describe("AWS KMS adapter", () => {
  it("sends GenerateDataKey/Decrypt with key id, AES_256 and the encryption context", async () => {
    const send = jest
      .fn()
      .mockResolvedValueOnce({
        Plaintext: new Uint8Array(32).fill(7),
        CiphertextBlob: new Uint8Array([1, 2, 3]),
        KeyId: "arn:key",
      })
      .mockResolvedValueOnce({ Plaintext: new Uint8Array(32).fill(7) });
    const aws = new AwsKms("alias/custodial", { send } as never);

    const dk = await aws.generateDataKey({ user_id: "u" });
    await aws.decryptDataKey(dk.ciphertext, dk.keyId, { user_id: "u" });

    expect(send.mock.calls[0][0].input).toEqual({
      KeyId: "alias/custodial",
      KeySpec: "AES_256",
      EncryptionContext: { user_id: "u" },
    });
    expect(send.mock.calls[1][0].input).toMatchObject({
      KeyId: "arn:key",
      EncryptionContext: { user_id: "u" },
    });
  });

  it("maps SDK errors without leaking their payloads", async () => {
    const send = jest.fn().mockRejectedValue(
      Object.assign(
        new Error("User arn:aws:iam::1:role/app is not authorized"),
        {
          name: "AccessDeniedException",
        }
      )
    );
    const err = await new AwsKms("k", { send } as never)
      .generateDataKey({})
      .catch(e => e);
    expect(err).toMatchObject({ code: "KMS_ACCESS_DENIED" });
    expect(err.message).not.toContain("arn:aws:iam");
  });

  it("treats an incomplete KMS response as a failure", async () => {
    const send = jest
      .fn()
      .mockResolvedValue({ CiphertextBlob: new Uint8Array(1) });
    await expectCode(
      new AwsKms("k", { send } as never).generateDataKey({}),
      "KMS_UNAVAILABLE"
    );
  });
});
