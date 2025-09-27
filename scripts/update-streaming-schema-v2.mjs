#!/usr/bin/env node

/**
 * Update database schema for V2 streaming implementation
 * This script adds the necessary V2 columns to support wallet-based streaming
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { Pool } from "@neondatabase/serverless";
import fs from 'fs';
import path from 'path';

const SCHEMA_FILE = path.join(process.cwd(), 'scripts', 'update-streaming-schema-v2.sql');

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Check your .env.local file.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function updateStreamingSchemaV2() {
  try {
    const schemaSql = fs.readFileSync(SCHEMA_FILE, 'utf8');
    const statements = schemaSql.split(';').filter(s => s.trim().length > 0);

    console.log(`Starting V2 streaming schema update from ${SCHEMA_FILE}`);
    console.log(`Found ${statements.length} SQL statements to execute.`);

    let successCount = 0;
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement) {
        try {
          console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
          await pool.query(statement);
          successCount++;
          console.log(`✅ Statement ${i + 1} executed successfully`);
        } catch (stmtError) {
          console.error(`❌ Error executing statement ${i + 1}:`, stmtError);
          throw stmtError; // Re-throw to stop further execution on error
        }
      }
    }

    console.log(`🎉 Successfully executed ${successCount} statements.`);
    console.log("Verifying V2 schema changes...");

    // Basic verification: check if new columns exist in 'users' table
    const newColumns = [
      'livepeer_stream_id_v2',
      'playback_id_v2',
      'stream_key_v2',
      'is_live_v2',
      'stream_started_at_v2',
      'stream_title_v2',
      'stream_description_v2',
      'stream_category_v2',
      'stream_tags_v2'
    ];

    const tables = ['users', 'stream_sessions_v2'];

    for (const table of tables) {
      try {
        const result = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = '${table}'
          );
        `);
        if (result.rows[0].exists) {
          console.log(`✅ Table '${table}' exists.`);
        } else {
          console.error(`❌ Table '${table}' does NOT exist.`);
          process.exit(1);
        }
      } catch (tableCheckError) {
        console.error(`❌ Error checking table '${table}':`, tableCheckError);
        process.exit(1);
      }
    }

    for (const column of newColumns) {
      try {
        const result = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'users' AND column_name = '${column}'
          );
        `);
        if (result.rows[0].exists) {
          console.log(`✅ Column '${column}' exists in 'users' table.`);
        } else {
          console.error(`❌ Column '${column}' does NOT exist in 'users' table.`);
          process.exit(1);
        }
      } catch (columnCheckError) {
        console.error(`❌ Error checking column '${column}':`, columnCheckError);
        process.exit(1);
      }
    }

    console.log("V2 schema update and verification complete.");
    console.log("✅ The database is now ready for V2 streaming APIs!");
    process.exit(0);
  } catch (error) {
    console.error('❌ V2 schema update failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

updateStreamingSchemaV2().catch(err => {
  console.error("Unhandled error during V2 schema update:", err);
  process.exit(1);
});
