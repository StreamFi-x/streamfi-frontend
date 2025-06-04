
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

async function createSubscribersTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscribers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        unsubscribed_at TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Subscribers table created or already exists");
  } catch (error) {
    console.error("Error creating subscribers table:", error);
  }
}

async function createUsersTable() {
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
        socialLinks JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Users table created or already exists");
  } catch (error) {
    console.error("Error creating users table:", error);
  }
}

async function createCategoryTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) UNIQUE NOT NULL,
        tags TEXT[], -- this is now an array of text
        imageUrl VARCHAR(255)
      );
    `);
    console.log("Categories table is created or already exists");
  } catch (error) {
    console.error("Error creating Categories table:", error);
  }
}


async function setupDatabase() {
  try {
    await createSubscribersTable();
    await createUsersTable()
    await createCategoryTable()
    console.log("Database setup completed");
  } catch (error) {
    console.error("Database setup failed:", error);
  } finally {
    await pool.end(); 
  }
}

setupDatabase(); 

