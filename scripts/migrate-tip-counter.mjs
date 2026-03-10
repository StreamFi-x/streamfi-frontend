import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { Pool } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Check your .env.local file.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  try {
    console.log(
      "Starting migration: Adding tip counter columns to users table..."
    );

    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS total_tips_received VARCHAR(255) DEFAULT '0.0000000',
      ADD COLUMN IF NOT EXISTS total_tips_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_tip_at TIMESTAMP WITH TIME ZONE;
    `);

    console.log("✅ Migration successful: Columns added successfully.");
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await pool.end();
  }
}

migrate();
