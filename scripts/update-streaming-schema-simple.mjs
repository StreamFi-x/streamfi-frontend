#!/usr/bin/env node

/**
 * Simplified database schema update script for new wallet-based streaming implementation
 * This script updates the database schema to support the new v2 streaming APIs
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { Pool } from "@neondatabase/serverless";
import fs from 'fs';
import path from 'path';

const SCHEMA_FILE = path.join(process.cwd(), 'scripts', 'update-streaming-schema-simple.sql');

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Check your .env.local file.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function updateStreamingSchema() {
  try {
    console.log('🚀 Starting streaming schema update...');
    
    // Check if schema file exists
    if (!fs.existsSync(SCHEMA_FILE)) {
      throw new Error(`Schema file not found: ${SCHEMA_FILE}`);
    }
    
    // Read schema file
    const schemaSQL = fs.readFileSync(SCHEMA_FILE, 'utf8');
    console.log('📄 Schema file loaded successfully');
    
    // Split into individual statements
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📊 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      try {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
        await pool.query(statement);
        successCount++;
        console.log(`✅ Statement ${i + 1} executed successfully`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Statement ${i + 1} failed:`, error.message);
        
        // Continue with other statements even if one fails
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate key') ||
            error.message.includes('column') && error.message.includes('already exists')) {
          console.log(`⚠️  Statement ${i + 1} skipped (already exists)`);
          successCount++;
          errorCount--;
        }
      }
    }
    
    console.log('\n📊 Schema update completed:');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    
    if (errorCount === 0) {
      console.log('🎉 All schema updates completed successfully!');
    } else {
      console.log('⚠️  Some schema updates failed, but the process continued.');
    }
    
    // Verify the new tables exist
    console.log('\n🔍 Verifying new tables...');
    
    const tables = [
      'streaming_analytics',
      'streaming_health', 
      'streaming_events',
      'streaming_webhooks',
      'streaming_integrations'
    ];
    
    for (const table of tables) {
      try {
        const result = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '${table}'
          );
        `);
        
        if (result.rows[0]?.exists) {
          console.log(`✅ Table '${table}' exists`);
        } else {
          console.log(`❌ Table '${table}' does not exist`);
        }
      } catch (error) {
        console.error(`❌ Error checking table '${table}':`, error.message);
      }
    }
    
    console.log('\n🎯 Schema update process completed!');
    console.log('📝 Next steps:');
    console.log('1. Test the new streaming APIs');
    console.log('2. Update your application to use the new v2 endpoints');
    console.log('3. Configure environment variables for the new features');
    console.log('4. Set up monitoring and analytics');
    
  } catch (error) {
    console.error('❌ Schema update failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the update
updateStreamingSchema()
  .then(() => {
    console.log('✅ Schema update completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Schema update failed:', error);
    process.exit(1);
  });
