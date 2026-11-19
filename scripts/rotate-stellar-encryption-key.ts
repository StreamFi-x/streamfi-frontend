import "dotenv/config";
import { sql } from "@vercel/postgres";
import { activeKey, loadKeyring } from "@/lib/security/keyring";
import { decryptSecret, encryptSecret } from "@/lib/security/encrypted-secrets";
import { processWalletKeyBatch } from "@/lib/security/stellar-key-rotation";

const BATCH_SIZE = 100;
const DRY_RUN = process.argv.includes("--dry-run");

async function rotateColumn(purpose: "STELLAR" | "TOTP") {
  const secretName = purpose === "STELLAR" ? "stellar_encryption" : "totp_encryption";
  const keyring = loadKeyring(
    `${purpose}_ENCRYPTION_KEYRING_JSON`,
    purpose === "STELLAR" ? "STELLAR_ENCRYPTION_KEY" : "TOTP_ENCRYPTION_KEY",
    "hex"
  );
  const active = activeKey(keyring);
  const { rows: checkpoints } = await sql`SELECT last_user_id, processed_count FROM secret_rotation_checkpoints WHERE secret_name = ${secretName}`;
  let lastUserId = checkpoints[0]?.last_user_id as string | null ?? null;
  let processed = Number(checkpoints[0]?.processed_count ?? 0);
  let batchCount = 0;

  while (true) {
    const { rows } = purpose === "STELLAR"
      ? await sql`
          SELECT id, encrypted_stellar_key AS encrypted_value FROM users
          WHERE encrypted_stellar_key IS NOT NULL AND (${lastUserId}::UUID IS NULL OR id > ${lastUserId}::UUID)
          ORDER BY id ASC LIMIT ${BATCH_SIZE}
        `
      : await sql`
          SELECT id, totp_secret_enc AS encrypted_value FROM users
          WHERE totp_secret_enc IS NOT NULL AND (${lastUserId}::UUID IS NULL OR id > ${lastUserId}::UUID)
          ORDER BY id ASC LIMIT ${BATCH_SIZE}
        `;
    if (!rows.length) {break;}
    batchCount += 1;
    const batchResult = await processWalletKeyBatch(
      rows.map(row => ({ id: String(row.id), encrypted_stellar_key: String(row.encrypted_value) })),
      active.kid,
      DRY_RUN,
      envelope => decryptSecret(envelope, purpose),
      plaintext => encryptSecret(plaintext, purpose),
      async (id, oldEnvelope, replacement) => {
        if (purpose === "STELLAR") {
          await sql`UPDATE users SET encrypted_stellar_key = ${replacement}, updated_at = now() WHERE id = ${id} AND encrypted_stellar_key = ${oldEnvelope}`;
        } else {
          await sql`UPDATE users SET totp_secret_enc = ${replacement}, updated_at = now() WHERE id = ${id} AND totp_secret_enc = ${oldEnvelope}`;
        }
      }
    );
    lastUserId = batchResult.lastUserId;
    processed += batchResult.examined;

    if (!DRY_RUN) {
      await sql`
        INSERT INTO secret_rotation_checkpoints (secret_name, last_user_id, processed_count, updated_at)
        VALUES (${secretName}, ${lastUserId}, ${processed}, now())
        ON CONFLICT (secret_name) DO UPDATE SET last_user_id = EXCLUDED.last_user_id,
          processed_count = EXCLUDED.processed_count, updated_at = now()
      `;
    }
    console.info(`${purpose} ${DRY_RUN ? "would process" : "processed"} batch ${batchCount}; rows seen: ${processed}`);
  }
  console.info(`${purpose} ${DRY_RUN ? "dry run complete" : "rotation complete"}. Rows examined: ${processed}.`);
}

async function main() {
  await rotateColumn("STELLAR");
  await rotateColumn("TOTP");
}

main().catch(error => {
  console.error("Encryption-key rotation failed", error);
  process.exitCode = 1;
});