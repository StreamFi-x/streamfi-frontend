import { sql } from "@vercel/postgres";
import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });

async function fixStreamSessionsSchema() {
  try {
    console.log("🔧 Fixing stream_sessions schema...");

    // Make livepeer_stream_id nullable
    await sql`
      ALTER TABLE stream_sessions
      ALTER COLUMN livepeer_stream_id DROP NOT NULL
    `;

    console.log("✅ Successfully made livepeer_stream_id nullable");
    console.log("✅ Migration complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

fixStreamSessionsSchema();
