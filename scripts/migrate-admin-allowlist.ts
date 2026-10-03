import "dotenv/config";
import { sql } from "@vercel/postgres";

async function main() {
  const privyIds = (process.env.ADMIN_PRIVY_IDS ?? "").split(",").map(value => value.trim()).filter(Boolean);
  const wallets = (process.env.ADMIN_WALLET_ADDRESSES ?? "").split(",").map(value => value.trim()).filter(Boolean);

  for (const privyId of privyIds) {
    await sql`UPDATE users SET role = 'super_admin' WHERE privy_id = ${privyId}`;
  }
  for (const wallet of wallets) {
    await sql`UPDATE users SET role = 'super_admin' WHERE LOWER(wallet) = LOWER(${wallet})`;
  }

  console.info(`Migrated ${privyIds.length + wallets.length} configured admin identities. Remove the allowlist variables after confirming each identity maps to a user.`);
}

main().catch(error => {
  console.error("Unable to migrate admin allowlists", error);
  process.exitCode = 1;
});