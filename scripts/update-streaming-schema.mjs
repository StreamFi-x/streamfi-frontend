#!/usr/bin/env node

/**
 * Database schema update script for new wallet-based streaming implementation
 * This script updates the database schema to support the new v2 streaming APIs
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { Pool } from "@neondatabase/serverless";
import fs from 'fs';
import path from 'path';

const SCHEMA_FILE = path.join(process.cwd(), 'scripts', 'update-streaming-schema.sql');

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
    
    // Check new columns in users table
    console.log('\n🔍 Verifying new columns in users table...');
    
    const newColumns = [
      'streaming_v2_enabled',
      'stream_quality',
      'stream_resolution',
      'stream_bitrate',
      'stream_fps',
      'stream_audio_codec',
      'stream_video_codec',
      'stream_ingest_type',
      'stream_recording_enabled',
      'stream_multistream_enabled',
      'stream_analytics_enabled',
      'stream_chat_enabled',
      'stream_moderation_enabled',
      'stream_private',
      'stream_password',
      'stream_whitelist',
      'stream_blacklist',
      'stream_metadata',
      'stream_settings',
      'stream_webhook_url',
      'stream_webhook_secret',
      'stream_webhook_events',
      'stream_analytics_data',
      'stream_performance_data',
      'stream_last_health_check',
      'stream_health_status',
      'stream_error_count',
      'stream_success_count',
      'stream_total_duration',
      'stream_peak_viewers',
      'stream_total_views',
      'stream_engagement_score',
      'stream_quality_score',
      'stream_uptime_percentage',
      'stream_last_activity',
      'stream_auto_start',
      'stream_auto_stop',
      'stream_auto_stop_duration',
      'stream_schedule_start',
      'stream_schedule_end',
      'stream_schedule_recurring',
      'stream_schedule_days',
      'stream_notifications_enabled',
      'stream_notification_events',
      'stream_backup_enabled',
      'stream_backup_provider',
      'stream_backup_config',
      'stream_cdn_enabled',
      'stream_cdn_provider',
      'stream_cdn_config',
      'stream_transcoding_enabled',
      'stream_transcoding_profiles',
      'stream_adaptive_bitrate',
      'stream_adaptive_profiles',
      'stream_thumbnail_url',
      'stream_thumbnail_auto_generate',
      'stream_thumbnail_update_interval',
      'stream_watermark_enabled',
      'stream_watermark_url',
      'stream_watermark_position',
      'stream_watermark_opacity',
      'stream_overlay_enabled',
      'stream_overlay_config',
      'stream_chat_bot_enabled',
      'stream_chat_bot_config',
      'stream_moderation_config',
      'stream_analytics_config',
      'stream_integrations',
      'stream_api_keys',
      'stream_webhooks',
      'stream_events',
      'stream_logs',
      'stream_metrics',
      'stream_health_history',
      'stream_performance_history',
      'stream_analytics_history',
      'stream_error_history',
      'stream_success_history',
      'stream_viewer_history',
      'stream_engagement_history',
      'stream_quality_history',
      'stream_uptime_history',
      'stream_duration_history',
      'stream_bitrate_history',
      'stream_resolution_history',
      'stream_fps_history',
      'stream_audio_history',
      'stream_video_history',
      'stream_network_history',
      'stream_device_history',
      'stream_browser_history',
      'stream_os_history',
      'stream_country_history',
      'stream_city_history',
      'stream_isp_history',
      'stream_mobile_history',
      'stream_desktop_history',
      'stream_tablet_history',
      'stream_tv_history',
      'stream_console_history',
      'stream_other_history'
    ];
    
    let existingColumns = 0;
    let missingColumns = 0;
    
    for (const column of newColumns) {
      try {
        const result = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'users' 
            AND column_name = '${column}'
          );
        `);
        
        if (result.rows[0]?.exists) {
          existingColumns++;
        } else {
          missingColumns++;
          console.log(`❌ Column '${column}' is missing`);
        }
      } catch (error) {
        console.error(`❌ Error checking column '${column}':`, error.message);
        missingColumns++;
      }
    }
    
    console.log(`\n📊 Column verification completed:`);
    console.log(`✅ Existing columns: ${existingColumns}`);
    console.log(`❌ Missing columns: ${missingColumns}`);
    
    if (missingColumns === 0) {
      console.log('🎉 All new columns added successfully!');
    } else {
      console.log('⚠️  Some columns are missing. You may need to run the script again.');
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
