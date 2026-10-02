import {
  DecryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
} from "@aws-sdk/client-kms";
import { CustodialKeyError, type CustodialKeyErrorCode } from "./errors";

/**
 * Key-encryption-key (KEK) operations for custodial Stellar keys (#1396).
 *
 * The KEK lives in AWS KMS and never leaves it: the application can only ask
 * KMS to mint a data key (GenerateDataKey) or to unwrap one (Decrypt). Every
 * call carries an encryption context naming the purpose and the owning user,
 * which KMS binds cryptographically to the wrapped key and records in
 * CloudTrail — giving a per-user audit trail of every decryption.
 */

export type KmsEncryptionContext = Record<string, string>;

export interface GeneratedDataKey {
  /** 32-byte AES key. Callers must zero it (`fill(0)`) after use. */
  plaintext: Buffer;
  /** The data key wrapped under the KEK — safe to store. */
  ciphertext: Buffer;
  /** Full ARN of the KMS key that wrapped it. */
  keyId: string;
}

export interface KeyManagementService {
  generateDataKey(context: KmsEncryptionContext): Promise<GeneratedDataKey>;
  decryptDataKey(
    ciphertext: Buffer,
    keyId: string,
    context: KmsEncryptionContext
  ): Promise<Buffer>;
}

const ERROR_CODES: Record<string, CustodialKeyErrorCode> = {
  AccessDeniedException: "KMS_ACCESS_DENIED",
  NotFoundException: "KMS_KEY_UNAVAILABLE",
  DisabledException: "KMS_KEY_UNAVAILABLE",
  KMSInvalidStateException: "KMS_KEY_UNAVAILABLE",
  KeyUnavailableException: "KMS_KEY_UNAVAILABLE",
  IncorrectKeyException: "KMS_WRONG_KEY",
  InvalidCiphertextException: "KMS_INVALID_CIPHERTEXT",
  ThrottlingException: "KMS_THROTTLED",
  LimitExceededException: "KMS_THROTTLED",
};

/** Maps an AWS SDK error to a CustodialKeyError without leaking its payload. */
export function mapKmsError(err: unknown): CustodialKeyError {
  const name = (err as { name?: string } | null)?.name ?? "";
  const code = ERROR_CODES[name] ?? "KMS_UNAVAILABLE";
  return new CustodialKeyError(
    code,
    `KMS request failed (${name || "unknown"})`
  );
}

export class AwsKms implements KeyManagementService {
  constructor(
    private readonly keyId: string,
    private readonly client: Pick<KMSClient, "send">
  ) {}

  async generateDataKey(
    context: KmsEncryptionContext
  ): Promise<GeneratedDataKey> {
    try {
      const out = await this.client.send(
        new GenerateDataKeyCommand({
          KeyId: this.keyId,
          KeySpec: "AES_256",
          EncryptionContext: context,
        })
      );
      if (!out.Plaintext || !out.CiphertextBlob || !out.KeyId) {
        throw new CustodialKeyError(
          "KMS_UNAVAILABLE",
          "KMS GenerateDataKey returned an incomplete response"
        );
      }
      const plaintext = Buffer.from(out.Plaintext);
      out.Plaintext.fill(0);
      return {
        plaintext,
        ciphertext: Buffer.from(out.CiphertextBlob),
        keyId: out.KeyId,
      };
    } catch (err) {
      throw err instanceof CustodialKeyError ? err : mapKmsError(err);
    }
  }

  async decryptDataKey(
    ciphertext: Buffer,
    keyId: string,
    context: KmsEncryptionContext
  ): Promise<Buffer> {
    try {
      const out = await this.client.send(
        new DecryptCommand({
          CiphertextBlob: ciphertext,
          // Pinning the key id makes KMS refuse to unwrap under any other key.
          KeyId: keyId,
          EncryptionContext: context,
        })
      );
      if (!out.Plaintext) {
        throw new CustodialKeyError(
          "KMS_UNAVAILABLE",
          "KMS Decrypt returned an incomplete response"
        );
      }
      const plaintext = Buffer.from(out.Plaintext);
      out.Plaintext.fill(0);
      return plaintext;
    } catch (err) {
      throw err instanceof CustodialKeyError ? err : mapKmsError(err);
    }
  }
}

let _kms: KeyManagementService | null = null;

/**
 * KMS for custodial keys, configured by:
 *   CUSTODIAL_KEY_KMS_KEY_ID   key ARN or alias ARN (required)
 *   CUSTODIAL_KEY_KMS_REGION   defaults to AWS_REGION
 * Credentials come from the standard AWS provider chain (see
 * docs/custodial-key-kms.md for the least-privilege IAM policy).
 */
export function getKms(): KeyManagementService {
  if (_kms) {
    return _kms;
  }
  const keyId = process.env.CUSTODIAL_KEY_KMS_KEY_ID;
  if (!keyId) {
    throw new CustodialKeyError(
      "KMS_NOT_CONFIGURED",
      "CUSTODIAL_KEY_KMS_KEY_ID is not configured"
    );
  }
  const client = new KMSClient({
    region: process.env.CUSTODIAL_KEY_KMS_REGION ?? process.env.AWS_REGION,
    maxAttempts: 3,
    requestHandler: { connectionTimeout: 2_000, requestTimeout: 5_000 },
  });
  _kms = new AwsKms(keyId, client);
  return _kms;
}

/** Test hook: inject a KMS implementation. Pass null to reset. */
export function setKmsForTesting(kms: KeyManagementService | null) {
  _kms = kms;
}
