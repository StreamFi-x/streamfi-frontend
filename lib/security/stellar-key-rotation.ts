export type EncryptedKeyRow = { id: string; encrypted_stellar_key: string };

export async function processWalletKeyBatch(
  rows: EncryptedKeyRow[],
  activeKid: string,
  dryRun: boolean,
  decrypt: (envelope: string) => string,
  encrypt: (plaintext: string) => string,
  replace: (id: string, oldEnvelope: string, newEnvelope: string) => Promise<void>
): Promise<{ examined: number; rewritten: number; lastUserId: string | null }> {
  let rewritten = 0;
  for (const row of rows) {
    if (!row.encrypted_stellar_key.startsWith(`v1:${activeKid}:`)) {
      const plaintext = decrypt(row.encrypted_stellar_key);
      if (!dryRun) {
        await replace(row.id, row.encrypted_stellar_key, encrypt(plaintext));
        rewritten += 1;
      }
    }
  }
  return {
    examined: rows.length,
    rewritten,
    lastUserId: rows.length ? rows[rows.length - 1].id : null,
  };
}