#!/usr/bin/env node

/**
 * Create streaming tables script
 * This script creates the new streaming tables one by one
 */

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

async function createStreamingTables() {
  try {
    console.log('🚀 Creating streaming tables...');
    
    // Create streaming_analytics table
    console.log('📊 Creating streaming_analytics table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS streaming_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        stream_id VARCHAR(255) NOT NULL,
        session_id UUID,
        viewer_count INTEGER DEFAULT 0,
        peak_viewers INTEGER DEFAULT 0,
        total_viewers INTEGER DEFAULT 0,
        unique_viewers INTEGER DEFAULT 0,
        returning_viewers INTEGER DEFAULT 0,
        new_viewers INTEGER DEFAULT 0,
        total_watch_time INTEGER DEFAULT 0,
        average_watch_time INTEGER DEFAULT 0,
        engagement_score DECIMAL(5,2) DEFAULT 0.00,
        retention_rate DECIMAL(5,2) DEFAULT 0.00,
        bounce_rate DECIMAL(5,2) DEFAULT 0.00,
        bitrate INTEGER DEFAULT 0,
        resolution VARCHAR(20),
        fps INTEGER DEFAULT 0,
        audio_codec VARCHAR(20),
        video_codec VARCHAR(20),
        network_latency INTEGER DEFAULT 0,
        buffer_events INTEGER DEFAULT 0,
        quality_score DECIMAL(5,2) DEFAULT 0.00,
        country VARCHAR(2),
        city VARCHAR(100),
        region VARCHAR(100),
        isp VARCHAR(100),
        device_type VARCHAR(20),
        browser VARCHAR(50),
        os VARCHAR(50),
        platform VARCHAR(20),
        recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        duration INTEGER DEFAULT 0,
        metadata JSONB DEFAULT '{}',
        raw_data JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ streaming_analytics table created');
    
    // Create streaming_health table
    console.log('🏥 Creating streaming_health table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS streaming_health (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        stream_id VARCHAR(255) NOT NULL,
        session_id UUID,
        status VARCHAR(20) NOT NULL,
        is_active BOOLEAN DEFAULT FALSE,
        is_ingesting BOOLEAN DEFAULT FALSE,
        is_playback_available BOOLEAN DEFAULT FALSE,
        ingest_rate DECIMAL(10,2) DEFAULT 0.00,
        outgoing_rate DECIMAL(10,2) DEFAULT 0.00,
        bitrate INTEGER DEFAULT 0,
        resolution VARCHAR(20),
        fps INTEGER DEFAULT 0,
        audio_level DECIMAL(5,2) DEFAULT 0.00,
        video_quality DECIMAL(5,2) DEFAULT 0.00,
        latency INTEGER DEFAULT 0,
        packet_loss DECIMAL(5,2) DEFAULT 0.00,
        jitter INTEGER DEFAULT 0,
        bandwidth INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        warning_count INTEGER DEFAULT 0,
        last_error VARCHAR(500),
        last_warning VARCHAR(500),
        last_seen TIMESTAMP WITH TIME ZONE,
        last_ingest TIMESTAMP WITH TIME ZONE,
        last_playback TIMESTAMP WITH TIME ZONE,
        checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB DEFAULT '{}',
        raw_data JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ streaming_health table created');
    
    // Create streaming_events table
    console.log('📅 Creating streaming_events table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS streaming_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        stream_id VARCHAR(255) NOT NULL,
        session_id UUID,
        event_type VARCHAR(50) NOT NULL,
        event_data JSONB DEFAULT '{}',
        event_metadata JSONB DEFAULT '{}',
        triggered_by VARCHAR(50),
        source VARCHAR(100),
        ip_address INET,
        user_agent TEXT,
        occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        raw_data JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ streaming_events table created');
    
    // Create streaming_webhooks table
    console.log('🔗 Creating streaming_webhooks table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS streaming_webhooks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        url VARCHAR(500) NOT NULL,
        secret VARCHAR(255),
        events TEXT[] NOT NULL DEFAULT '{}',
        is_active BOOLEAN DEFAULT TRUE,
        auth_type VARCHAR(20) DEFAULT 'none',
        auth_config JSONB DEFAULT '{}',
        rate_limit INTEGER DEFAULT 100,
        rate_limit_window INTEGER DEFAULT 60,
        max_retries INTEGER DEFAULT 3,
        retry_delay INTEGER DEFAULT 1000,
        timeout INTEGER DEFAULT 30000,
        total_requests INTEGER DEFAULT 0,
        successful_requests INTEGER DEFAULT 0,
        failed_requests INTEGER DEFAULT 0,
        last_request_at TIMESTAMP WITH TIME ZONE,
        last_success_at TIMESTAMP WITH TIME ZONE,
        last_failure_at TIMESTAMP WITH TIME ZONE,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ streaming_webhooks table created');
    
    // Create streaming_integrations table
    console.log('🔌 Creating streaming_integrations table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS streaming_integrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        provider VARCHAR(50) NOT NULL,
        integration_type VARCHAR(50) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        config JSONB DEFAULT '{}',
        credentials JSONB DEFAULT '{}',
        status VARCHAR(20) DEFAULT 'active',
        last_sync TIMESTAMP WITH TIME ZONE,
        last_error VARCHAR(500),
        error_count INTEGER DEFAULT 0,
        total_events INTEGER DEFAULT 0,
        successful_events INTEGER DEFAULT 0,
        failed_events INTEGER DEFAULT 0,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ streaming_integrations table created');
    
    console.log('\n🎉 All streaming tables created successfully!');
    
  } catch (error) {
    console.error('❌ Failed to create streaming tables:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the table creation
createStreamingTables()
  .then(() => {
    console.log('✅ Streaming tables creation completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Streaming tables creation failed:', error);
    process.exit(1);
  });

