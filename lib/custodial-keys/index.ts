import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { logger } from "@/lib/tracing/logger";
import { CustodialKeyError } from "./errors";
import { getKms, type KmsEncryptionContext } from "./kms";
import { decryptLegacyCustodialSecret, isLegacyFormat } from "./legacy";

/**
 * Envelope encryption for custodial Stellar secret keys (#1396).
 *
 *   secret ──AES-256-GCM(DEK, AAD=user)──▶ ciphertext + iv + tag
 *   DEK    ──KMS GenerateDataKey(KEK, context=user)──▶ wrapped DEK
 *
 * Every wallet gets its own random 256-bit data key (DEK), so a leaked DEK
 * exposes exactly one wallet, and the KEK that wraps all DEKs never leaves
 * KMS. Decrypting any wallet requires a KMS Decrypt call made with that
 * user's encryption context — access is logged by KMS and revocable there.
 *
 * Stored format (users.encrypted_stellar_key), explicitly versioned so a
 * record is never classified by guessing at its shape:
 *
 *   ckv2:<base64url(JSON {v, alg, kms, kid, edk, iv, tag, ct})>
 *
 * The user id is bound in both the GCM AAD and the KMS encryption context,
 * so an envelope copied onto another user's row does not decrypt.
 */

export const ENVELOPE_PREFIX = "ckv2:";
const ENVELOPE_VERSION = 2;
const ALGORITHM = "AES-256-GCM";
const KMS_PROVIDER = "aws-kms";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export type CustodialKeyFormat = "kms_envelope_v2" | "legacy_v1" | "unknown";

interface EnvelopeV2 {
  v: 2;
  alg: typeof ALGORITHM;
  kms: typeof KMS_PROVIDER;
  kid: string;
  edk: string;
  iv: string;
  tag: string;
  ct: string;
}

export function detectCustodialKeyFormat(stored: string): CustodialKeyFormat {
  if (stored.startsWith(ENVELOPE_PREFIX)) {
    return "kms_envelope_v2";
  }
  return isLegacyFormat(stored) ? "legacy_v1" : "unknown";
}

function kmsContext(userId: string): KmsEncryptionContext {
  return { purpose: "streamfi-custodial-stellar-key", user_id: userId };
}

function aad(userId: string): Buffer {
  return Buffer.from(`streamfi/custodial-stellar-key/v2/${userId}`, "utf8");
}

function parseEnvelope(stored: string): EnvelopeV2 {
  let env: Partial<EnvelopeV2>;
  try {
    env = JSON.parse(
      Buffer.from(stored.slice(ENVELOPE_PREFIX.length), "base64url").toString(
        "utf8"
      )
    );
  } catch {
    throw new CustodialKeyError("ENVELOPE_INVALID", "Malformed key envelope");
  }
  const valid =
    env?.v === ENVELOPE_VERSION &&
    env.alg === ALGORITHM &&
    env.kms === KMS_PROVIDER &&
    [env.kid, env.edk, env.iv, env.tag, env.ct].every(
      f => typeof f === "string" && f.length > 0
    ) &&
    Buffer.from(env.iv as string, "base64url").length === IV_BYTES &&
    Buffer.from(env.tag as string, "base64url").length === TAG_BYTES;
  if (!valid) {
    throw new CustodialKeyError(
      "ENVELOPE_INVALID",
      "Key envelope is missing fields or has an unsupported version"
    );
  }
  return env as EnvelopeV2;
}

/** The KMS key (ARN) that wraps an envelope's DEK. */
export function envelopeKeyId(stored: string): string {
  return parseEnvelope(stored).kid;
}

/** Encrypts a custodial secret for `userId` under a fresh KMS data key. */
export async function encryptCustodialSecret(
  userId: string,
  secret: string
): Promise<string> {
  const dataKey = await getKms().generateDataKey(kmsContext(userId));
  try {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", dataKey.plaintext, iv, {
      authTagLength: TAG_BYTES,
    });
    cipher.setAAD(aad(userId));
    const ct = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
    const envelope: EnvelopeV2 = {
      v: ENVELOPE_VERSION,
      alg: ALGORITHM,
      kms: KMS_PROVIDER,
      kid: dataKey.keyId,
      edk: dataKey.ciphertext.toString("base64url"),
      iv: iv.toString("base64url"),
      tag: cipher.getAuthTag().toString("base64url"),
      ct: ct.toString("base64url"),
    };
    logger.info("custodial_key_kms_encrypt", {
      user_id: userId,
      kms_key_id: dataKey.keyId,
    });
    return (
      ENVELOPE_PREFIX +
      Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url")
    );
  } finally {
    dataKey.plaintext.fill(0);
  }
}

async function decryptEnvelope(
  userId: string,
  stored: string
): Promise<string> {
  const env = parseEnvelope(stored);
  const dek = await getKms().decryptDataKey(
    Buffer.from(env.edk, "base64url"),
    env.kid,
    kmsContext(userId)
  );
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      dek,
      Buffer.from(env.iv, "base64url"),
      { authTagLength: TAG_BYTES }
    );
    decipher.setAAD(aad(userId));
    decipher.setAuthTag(Buffer.from(env.tag, "base64url"));
    const secret = Buffer.concat([
      decipher.update(Buffer.from(env.ct, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    logger.info("custodial_key_kms_decrypt", {
      user_id: userId,
      kms_key_id: env.kid,
    });
    return secret;
  } catch {
    throw new CustodialKeyError(
      "ENVELOPE_AUTH_FAILED",
      "Custodial key envelope failed authentication"
    );
  } finally {
    dek.fill(0);
  }
}

/**
 * Decrypts a stored custodial secret. KMS envelopes go through KMS; legacy
 * rows (pre-migration) use the static key only while it is still configured.
 * A KMS failure is surfaced as-is — there is deliberately no fallback to the
 * static key, which would defeat the point of KMS.
 */
export async function decryptCustodialSecret(
  userId: string,
  stored: string
): Promise<string> {
  const format = detectCustodialKeyFormat(stored);
  if (format === "kms_envelope_v2") {
    return decryptEnvelope(userId, stored);
  }
  if (format === "legacy_v1") {
    logger.warn("custodial_key_legacy_decrypt", { user_id: userId });
    return decryptLegacyCustodialSecret(stored);
  }
  throw new CustodialKeyError(
    "UNKNOWN_FORMAT",
    "Stored custodial key has an unrecognised format"
  );
}

export { CustodialKeyError } from "./errors";
