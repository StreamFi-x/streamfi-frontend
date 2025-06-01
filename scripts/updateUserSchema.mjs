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

async function dropUsersTable() {
  try {
    await pool.query(`DROP TABLE IF EXISTS users CASCADE;`);
    console.log("Users table dropped successfully");
  } catch (error) {
    console.error("Error dropping users table:", error);
    throw error;
  }
}

async function createNewUsersTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        wallet VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        streamkey VARCHAR(255),
        avatar VARCHAR(255),
        bio TEXT,
        socialLinks JSONB,  -- Will store an array of objects with socialTitle and socialLink
        emailVerified BOOLEAN DEFAULT FALSE,
        emailNotifications BOOLEAN DEFAULT TRUE,
        creator JSONB,  -- Will store creator-specific data
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("New users table created successfully");
  } catch (error) {
    console.error("Error creating new users table:", error);
    throw error;
  }
}

async function updateSchema() {
  try {
    // Start a transaction
    await pool.query('BEGIN');
    
    // Drop the existing users table
    await dropUsersTable();
    
    // Create the new users table with additional fields
    await createNewUsersTable();
    
    // Commit the transaction
    await pool.query('COMMIT');
    
    console.log("Database schema updated successfully");
  } catch (error) {
    // Rollback the transaction in case of error
    await pool.query('ROLLBACK');
    console.error("Database schema update failed:", error);
  } finally {
    await pool.end();
  }
}

// Example of the new schema structure (for documentation purposes)
const exampleUser = {
  id: "uuid-here",
  wallet: "0x123...",
  username: "user123",
  email: "user@example.com",
  streamkey: "stream-key-123",
  avatar: "https://example.com/avatar.jpg",
  bio: "User bio here",
  socialLinks: [
    { socialTitle: "Twitter", socialLink: "https://twitter.com/user123" },
    { socialTitle: "Instagram", socialLink: "https://instagram.com/user123" }
  ],
  emailVerified: true,
  emailNotifications: true,
  creator: {
    streamTitle: "My Awesome Stream",
    tags: ["gaming", "crypto", "education"],
    category: "Technology",
    payout: "0xabc..."
  },
  created_at: "2025-05-13T10:00:00Z",
  updated_at: "2025-05-13T10:00:00Z"
};

console.log("Starting database schema update...");
updateSchema();