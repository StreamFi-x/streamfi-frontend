import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import type {
  GeneratedDataKey,
  KeyManagementService,
  KmsEncryptionContext,
} from "@/lib/custodial-keys/kms";
import { mapKmsError } from "@/lib/custodial-keys/kms";

/**
 * In-memory KMS for tests. Behaves like AWS KMS where it matters:
 *   - each key id has a master key that never leaves this object;
 *   - data keys are wrapped with AES-GCM using the encryption context as
 *     AAD, so a different context fails to unwrap;
 *   - Decrypt pinned to the wrong key id fails with IncorrectKeyException;
 *   - failures can be injected with AWS error names (AccessDeniedException,
 *     ThrottlingException, …) and are mapped exactly as in production.
 */
export class FakeKms implements KeyManagementService {
  private readonly masters = new Map<string, Buffer>();
  private injected: Array<{
    op: "generate" | "decrypt" | "any";
    name: string;
  }> = [];
  calls: Array<{ op: string; keyId: string; context: KmsEncryptionContext }> =
    [];
  /** Plaintext data keys handed out, to assert they get zeroed. */
  issued: Buffer[] = [];

  constructor(
    public activeKeyId = "arn:aws:kms:eu-west-1:111122223333:key/primary"
  ) {
    this.addKey(activeKeyId);
  }

  addKey(keyId: string) {
    this.masters.set(keyId, randomBytes(32));
  }

  /** The next matching call fails with an AWS SDK error of this name. */
  fail(name: string, op: "generate" | "decrypt" | "any" = "any") {
    this.injected.push({ op, name });
  }

  private maybeFail(op: "generate" | "decrypt") {
    const i = this.injected.findIndex(f => f.op === op || f.op === "any");
    if (i >= 0) {
      const [f] = this.injected.splice(i, 1);
      const err = Object.assign(new Error(`${f.name}: injected`), {
        name: f.name,
      });
      throw mapKmsError(err);
    }
  }

  private aad(context: KmsEncryptionContext) {
    return Buffer.from(
      JSON.stringify(
        Object.entries(context).sort(([a], [b]) => a.localeCompare(b))
      )
    );
  }

  async generateDataKey(
    context: KmsEncryptionContext
  ): Promise<GeneratedDataKey> {
    this.calls.push({ op: "generate", keyId: this.activeKeyId, context });
    this.maybeFail("generate");
    const master = this.masters.get(this.activeKeyId)!;
    const dek = randomBytes(32);
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", master, iv);
    c.setAAD(this.aad(context));
    const wrapped = Buffer.concat([c.update(dek), c.final()]);
    const blob = Buffer.concat([
      Buffer.from(this.activeKeyId.padEnd(128, "\0")),
      iv,
      c.getAuthTag(),
      wrapped,
    ]);
    const plaintext = Buffer.from(dek);
    this.issued.push(plaintext);
    return { plaintext, ciphertext: blob, keyId: this.activeKeyId };
  }

  async decryptDataKey(
    ciphertext: Buffer,
    keyId: string,
    context: KmsEncryptionContext
  ): Promise<Buffer> {
    this.calls.push({ op: "decrypt", keyId, context });
    this.maybeFail("decrypt");
    const wrappedBy = ciphertext
      .subarray(0, 128)
      .toString()
      .replace(/\0+$/, "");
    if (!this.masters.has(keyId)) {
      throw mapKmsError({ name: "NotFoundException" });
    }
    if (wrappedBy !== keyId) {
      throw mapKmsError({ name: "IncorrectKeyException" });
    }
    try {
      const d = createDecipheriv(
        "aes-256-gcm",
        this.masters.get(keyId)!,
        ciphertext.subarray(128, 140)
      );
      d.setAAD(this.aad(context));
      d.setAuthTag(ciphertext.subarray(140, 156));
      return Buffer.concat([d.update(ciphertext.subarray(156)), d.final()]);
    } catch {
      throw mapKmsError({ name: "InvalidCiphertextException" });
    }
  }
}
