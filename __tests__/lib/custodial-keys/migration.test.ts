/**
 * @jest-environment node
 *
 * #1396 — resumable, verified static-key → KMS-envelope migration.
 */

jest.mock(
  "@vercel/postgres",
  () => jest.requireActual("@/testing/fake-postgres").vercelPostgresMock
);

import { randomBytes } from "crypto";
import { Keypair } from "@stellar/stellar-sdk";
import { fakePostgres as db } from "@/testing/fake-postgres";
import { FakeKms } from "@/testing/fake-kms";
import { legacyEncrypt } from "@/testing/legacy-custodial-key";
import { setKmsForTesting } from "@/lib/custodial-keys/kms";
import {
  decryptCustodialSecret,
  detectCustodialKeyFormat,
} from "@/lib/custodial-keys";
import {
  LegacyRowsRemainError,
  migrateLegacyCustodialKeys,
  purgeLegacyBackups,
  verifyMigratedCustodialKeys,
} from "@/lib/custodial-keys/migration";
import {
  MemoryKvStore,
  setSecurityKvStoreForTesting,
} from "@/lib/security/kv-store";

const LEGACY_KEY = randomBytes(32).toString("hex");
const ORIGINAL_ENV = process.env;
const fetchMock = jest.fn();

let kms: FakeKms;
let output: string[];
let spies: jest.SpyInstance[];
const secrets = new Map<string, string>();

/** Seeds custodial users the way the pre-KMS onboarding route stored them. */
function seedLegacyUsers(n: number) {
  for (let i = 0; i < n; i++) {
    const id = `00000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`;
    const kp = Keypair.random();
    secrets.set(id, kp.secret());
    db.addUser({
      id,
      wallet: kp.publicKey(),
      encrypted_stellar_key: legacyEncrypt(kp.secret(), LEGACY_KEY),
    });
  }
  return [...secrets.keys()];
}

const formats = () =>
  [...db.state.users.values()].map(u =>
    detectCustodialKeyFormat(u.encrypted_stellar_key ?? "")
  );

async function expectAllKeysIntact() {
  for (const [id, secret] of secrets) {
    const u = db.user(id);
    await expect(
      decryptCustodialSecret(id, u.encrypted_stellar_key!)
    ).resolves.toBe(secret);
  }
}

beforeEach(() => {
  db.reset();
  secrets.clear();
  kms = new FakeKms();
  setKmsForTesting(kms);
  setSecurityKvStoreForTesting(new MemoryKvStore());
  process.env = {
    ...ORIGINAL_ENV,
    STELLAR_ENCRYPTION_KEY: LEGACY_KEY,
    OPS_ALERT_WEBHOOK_URL: "https://hooks.example.test/ops",
  };
  fetchMock.mockReset().mockResolvedValue(new Response("ok"));
  global.fetch = fetchMock as unknown as typeof fetch;
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
  setSecurityKvStoreForTesting(null);
});

describe("migration", () => {
  it("re-encrypts every legacy key into a verified KMS envelope", async () => {
    const ids = seedLegacyUsers(5);
    const before = ids.map(id => db.user(id).encrypted_stellar_key);

    const report = await migrateLegacyCustodialKeys({ batchSize: 2 });

    expect(report).toMatchObject({
      mode: "migrate",
      scanned: 5,
      succeeded: 5,
      failed: 0,
    });
    expect(formats()).toEqual(Array(5).fill("kms_envelope_v2"));
    ids.forEach((id, i) => {
      expect(db.user(id).encrypted_stellar_key_legacy).toBe(before[i]);
      expect(db.user(id).custodial_key_migrated_at).toBeInstanceOf(Date);
    });
    await expectAllKeysIntact();
    expect(db.state.custodial_key_migration_events).toHaveLength(5);
    expect(db.state.custodial_key_migration_events[0]).toMatchObject({
      mode: "migrate",
      outcome: "succeeded",
      reason: "migrated",
      kms_key_id: kms.activeKeyId,
    });
  });

  it("is idempotent: a second run touches nothing", async () => {
    seedLegacyUsers(3);
    await migrateLegacyCustodialKeys();
    const snapshot = [...db.state.users.values()].map(
      u => u.encrypted_stellar_key
    );

    const second = await migrateLegacyCustodialKeys();

    expect(second).toMatchObject({ scanned: 0, succeeded: 0 });
    expect(
      [...db.state.users.values()].map(u => u.encrypted_stellar_key)
    ).toEqual(snapshot);
  });

  it("resumes after an interruption without redoing or losing rows", async () => {
    seedLegacyUsers(6);

    // A deploy stops the run after three rows…
    const partial = await migrateLegacyCustodialKeys({ limit: 3 });
    expect(partial.succeeded).toBe(3);
    expect(formats().filter(f => f === "legacy_v1")).toHaveLength(3);

    // …the next run dies mid-way (DB connection lost after a row's UPDATE)…
    db.failOn(
      /^INSERT INTO custodial_key_migration_events/,
      new Error("connection lost")
    );
    await expect(migrateLegacyCustodialKeys()).rejects.toThrow(
      "connection lost"
    );

    // …and a rerun picks up exactly the rows still in the legacy format.
    const resumed = await migrateLegacyCustodialKeys();
    expect(resumed).toMatchObject({ scanned: 2, succeeded: 2, failed: 0 });
    expect(formats()).toEqual(Array(6).fill("kms_envelope_v2"));
    await expectAllKeysIntact();
  });

  it("leaves a row retryable when KMS is throttled, then migrates it on retry", async () => {
    const [first, second] = seedLegacyUsers(2);
    kms.fail("ThrottlingException", "generate");

    const report = await migrateLegacyCustodialKeys();
    expect(report).toMatchObject({ succeeded: 1, failed: 1 });
    expect(report.failures).toEqual([
      { user_id: first, reason: "kms_kms_throttled" },
    ]);
    expect(
      detectCustodialKeyFormat(db.user(first).encrypted_stellar_key!)
    ).toBe("legacy_v1");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const retry = await migrateLegacyCustodialKeys();
    expect(retry).toMatchObject({ scanned: 1, succeeded: 1 });
    expect(
      detectCustodialKeyFormat(db.user(second).encrypted_stellar_key!)
    ).toBe("kms_envelope_v2");
    await expectAllKeysIntact();
  });

  it("never marks a row migrated when the new envelope fails verification", async () => {
    const [id] = seedLegacyUsers(1);
    const original = db.user(id).encrypted_stellar_key;
    const realDecrypt = kms.decryptDataKey.bind(kms);
    kms.decryptDataKey = async (...args) => {
      const dek = await realDecrypt(...args);
      dek[0] ^= 0xff; // KMS hands back a wrong key
      return dek;
    };

    const report = await migrateLegacyCustodialKeys();

    expect(report.failures).toEqual([
      { user_id: id, reason: "kms_envelope_auth_failed" },
    ]);
    expect(db.user(id).encrypted_stellar_key).toBe(original);
    expect(db.user(id).custodial_key_migrated_at).toBeUndefined();
    expect(db.state.custodial_key_migration_events[0]).toMatchObject({
      outcome: "failed",
      reason: "kms_envelope_auth_failed",
    });
  });

  it("refuses to carry over a key that does not control the user's wallet", async () => {
    const [id] = seedLegacyUsers(1);
    db.user(id).wallet = Keypair.random().publicKey();

    const report = await migrateLegacyCustodialKeys();
    expect(report.failures).toEqual([
      { user_id: id, reason: "wallet_mismatch" },
    ]);
    expect(detectCustodialKeyFormat(db.user(id).encrypted_stellar_key!)).toBe(
      "legacy_v1"
    );

    const accepted = await migrateLegacyCustodialKeys({
      acceptWalletMismatch: true,
    });
    expect(accepted.succeeded).toBe(1);
    await expectAllKeysIntact();
  });

  it("reports undecryptable legacy rows without touching them", async () => {
    const [id] = seedLegacyUsers(1);
    db.user(id).encrypted_stellar_key = legacyEncrypt(
      "x",
      randomBytes(32).toString("hex")
    );
    const report = await migrateLegacyCustodialKeys();
    expect(report.failures).toEqual([
      { user_id: id, reason: "legacy_decrypt_legacy_auth_failed" },
    ]);
  });

  it("does not overwrite a key that changed while it was being migrated", async () => {
    const [id] = seedLegacyUsers(1);
    const realGenerate = kms.generateDataKey.bind(kms);
    kms.generateDataKey = async ctx => {
      db.user(id).encrypted_stellar_key = "ckv2:regenerated-meanwhile";
      return realGenerate(ctx);
    };
    const report = await migrateLegacyCustodialKeys();
    expect(report).toMatchObject({ succeeded: 0, skipped: 1 });
    expect(db.user(id).encrypted_stellar_key).toBe(
      "ckv2:regenerated-meanwhile"
    );
  });

  it("performs every check but writes nothing in dry-run mode", async () => {
    seedLegacyUsers(2);
    const report = await migrateLegacyCustodialKeys({ dryRun: true });
    expect(report).toMatchObject({ mode: "dry_run", succeeded: 2 });
    expect(formats()).toEqual(["legacy_v1", "legacy_v1"]);
    expect(db.state.custodial_key_migration_events.map(e => e.reason)).toEqual([
      "dry_run_verified",
      "dry_run_verified",
    ]);
  });

  it("never logs or stores plaintext keys", async () => {
    seedLegacyUsers(3);
    kms.fail("AccessDeniedException", "generate");
    await migrateLegacyCustodialKeys();
    await verifyMigratedCustodialKeys();
    const everything = [
      output.join("\n"),
      JSON.stringify(db.state.custodial_key_migration_events),
      JSON.stringify(fetchMock.mock.calls),
    ].join("\n");
    for (const secret of secrets.values()) {
      expect(everything).not.toContain(secret);
    }
  });
});

describe("verification and legacy retirement", () => {
  it("verifies every migrated envelope against the wallet and legacy backup", async () => {
    seedLegacyUsers(3);
    await migrateLegacyCustodialKeys();
    const report = await verifyMigratedCustodialKeys();
    expect(report).toMatchObject({
      mode: "verify",
      scanned: 3,
      succeeded: 3,
      failed: 0,
    });
  });

  it("flags an envelope that no longer matches its legacy backup", async () => {
    const [id] = seedLegacyUsers(2);
    await migrateLegacyCustodialKeys();
    db.user(id).encrypted_stellar_key_legacy = legacyEncrypt(
      Keypair.random().secret(),
      LEGACY_KEY
    );
    const report = await verifyMigratedCustodialKeys();
    expect(report.failures).toEqual([
      { user_id: id, reason: "legacy_backup_mismatch" },
    ]);
  });

  it("refuses to purge backups while legacy rows remain", async () => {
    seedLegacyUsers(2);
    await migrateLegacyCustodialKeys({ limit: 1 });
    await expect(purgeLegacyBackups()).rejects.toBeInstanceOf(
      LegacyRowsRemainError
    );
  });

  it("purges verified backups, after which the static key is no longer needed", async () => {
    seedLegacyUsers(3);
    await migrateLegacyCustodialKeys();

    const purge = await purgeLegacyBackups();
    expect(purge).toMatchObject({ mode: "purge_legacy", succeeded: 3 });
    expect(
      [...db.state.users.values()].every(
        u => u.encrypted_stellar_key_legacy === null
      )
    ).toBe(true);

    delete process.env.STELLAR_ENCRYPTION_KEY;
    await expectAllKeysIntact();
    expect(await verifyMigratedCustodialKeys()).toMatchObject({
      succeeded: 3,
      failed: 0,
    });
  });

  it("keeps a backup whose envelope fails re-verification", async () => {
    const [id] = seedLegacyUsers(2);
    await migrateLegacyCustodialKeys();
    kms.fail("KeyUnavailableException", "decrypt");
    const purge = await purgeLegacyBackups();
    expect(purge.failures).toEqual([
      { user_id: id, reason: "kms_kms_key_unavailable" },
    ]);
    expect(db.user(id).encrypted_stellar_key_legacy).not.toBeNull();
  });
});
