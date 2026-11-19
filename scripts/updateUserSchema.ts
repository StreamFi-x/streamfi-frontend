/**
 * One-off destructive schema reset: drops and recreates the `users` table.
 *
 * DANGER: not idempotent in a safe sense. Running this a second time, or
 * running it against a database that already has real user data, destroys
 * that data with no backup. Tracked in `script_runs` (see
 * lib/scripts/registry.ts and docs/scripts-registry.md) so a second
 * accidental invocation against the same database fails loudly instead of
 * silently dropping the table again.
 *
 * Usage:
 *   npm run update-schema             # refuses if already run; see error for how to override
 *   npm run update-schema -- --force  # re-run anyway (only after manual review)
 */
import "dotenv/config";
import { Pool } from "@neondatabase/serverless";
import { ScriptAlreadyRanError, runOnce } from "../lib/scripts/registry";

const SCRIPT_ID = "updateUserSchema";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Check your .env.local file.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const force = process.argv.includes("--force");

async function dropUsersTable(): Promise<void> {
  await pool.query(`DROP TABLE IF EXISTS users CASCADE;`);
  console.log("Users table dropped successfully");
}

async function createNewUsersTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wallet VARCHAR(255) UNIQUE NOT NULL,
      username VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      streamkey VARCHAR(255),
      avatar VARCHAR(255),
      bio TEXT,
      socialLinks JSONB,
      emailVerified BOOLEAN DEFAULT FALSE,
      emailNotifications BOOLEAN DEFAULT TRUE,
      creator JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("New users table created successfully");
}

async function updateSchema(): Promise<void> {
  await pool.query("BEGIN");
  try {
    await dropUsersTable();
    await createNewUsersTable();
    await pool.query("COMMIT");
    console.log("Database schema updated successfully");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

async function main(): Promise<void> {
  console.log("Starting database schema update...");
  try {
    await runOnce(pool, SCRIPT_ID, updateSchema, { force });
  } catch (error) {
    if (error instanceof ScriptAlreadyRanError) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error("Database schema update failed:", error);
  process.exitCode = 1;
});
