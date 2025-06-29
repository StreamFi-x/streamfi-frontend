import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function GET() {
  try {
    console.log('🔍 Checking what\'s missing in database...');
    
    const results = [];
    const skipped = [];
    
    
    const tablesResult = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    const existingTables = tablesResult.rows.map(row => row.table_name);
    console.log('📊 Existing tables:', existingTables);
    
    
    let existingUserColumns: string[] = [];
    if (existingTables.includes('users')) {
      const columnsResult = await sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY column_name
      `;
      existingUserColumns = columnsResult.rows.map(row => row.column_name as string);
      console.log('📊 Existing user columns:', existingUserColumns);
    }
    
    
    const requiredUserColumns = [
      'livepeer_stream_id',
      'playback_id',
      'is_live',
      'current_viewers',
      'total_views',
      'stream_started_at',
      'emailverified',
      'emailnotifications',
      'creator'
    ];
    
    const missingUserColumns = requiredUserColumns.filter(col => 
      !existingUserColumns.includes(col)
    );
    
    if (missingUserColumns.length > 0) {
      console.log('📊 Adding missing user columns:', missingUserColumns);
      
      
      try {
        await sql`
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS livepeer_stream_id VARCHAR(255),
          ADD COLUMN IF NOT EXISTS playback_id VARCHAR(255),
          ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS current_viewers INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS total_views INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS stream_started_at TIMESTAMP WITH TIME ZONE,
          ADD COLUMN IF NOT EXISTS emailverified BOOLEAN DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS emailnotifications BOOLEAN DEFAULT TRUE,
          ADD COLUMN IF NOT EXISTS creator JSONB DEFAULT '{}'
        `;
        results.push(`✅ Added ${missingUserColumns.length} missing columns to users table`);
      } catch (columnError) {
        console.error('❌ Failed to add user columns:', columnError);
        results.push('❌ Failed to add missing user columns');
      }
    } else {
      skipped.push('⏭️ Users table already has all required columns');
    }
    
    
    
    
    if (!existingTables.includes('stream_sessions')) {
      console.log('📊 Creating missing table: stream_sessions');
      try {
        await sql`
          CREATE TABLE stream_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            livepeer_stream_id VARCHAR(255) NOT NULL,
            playback_id VARCHAR(255) NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            category VARCHAR(100),
            tags TEXT[],
            status VARCHAR(50) DEFAULT 'idle',
            started_at TIMESTAMP WITH TIME ZONE,
            ended_at TIMESTAMP WITH TIME ZONE,
            duration_seconds INTEGER,
            peak_viewers INTEGER DEFAULT 0,
            total_views INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          )
        `;
        results.push('✅ Created missing table: stream_sessions');
      } catch (tableError) {
        console.error('❌ Failed to create stream_sessions table:', tableError);
        results.push('❌ Failed to create table: stream_sessions');
      }
    } else {
      skipped.push('⏭️ Table \'stream_sessions\' already exists');
    }
    
    
    if (!existingTables.includes('chat_messages')) {
      console.log('📊 Creating missing table: chat_messages');
      try {
        await sql`
          CREATE TABLE chat_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            stream_session_id UUID,
            user_id UUID,
            username VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            message_type VARCHAR(50) DEFAULT 'text',
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            is_moderator BOOLEAN DEFAULT FALSE,
            is_deleted BOOLEAN DEFAULT FALSE
          )
        `;
        results.push('✅ Created missing table: chat_messages');
      } catch (tableError) {
        console.error('❌ Failed to create chat_messages table:', tableError);
        results.push('❌ Failed to create table: chat_messages');
      }
    } else {
      skipped.push('⏭️ Table \'chat_messages\' already exists');
    }
    
    
    if (!existingTables.includes('stream_viewers')) {
      console.log('📊 Creating missing table: stream_viewers');
      try {
        await sql`
          CREATE TABLE stream_viewers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            stream_session_id UUID,
            user_id UUID,
            ip_address INET,
            user_agent TEXT,
            joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            left_at TIMESTAMP WITH TIME ZONE,
            watch_duration_seconds INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT TRUE
          )
        `;
        results.push('✅ Created missing table: stream_viewers');
      } catch (tableError) {
        console.error('❌ Failed to create stream_viewers table:', tableError);
        results.push('❌ Failed to create table: stream_viewers');
      }
    } else {
      skipped.push('⏭️ Table \'stream_viewers\' already exists');
    }
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet)`;
      results.push('✅ Created/verified index: idx_users_wallet');
    } catch {
      skipped.push('⏭️ Index idx_users_wallet already exists or failed');
    }
    
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_users_livepeer ON users(livepeer_stream_id)`;
      results.push('✅ Created/verified index: idx_users_livepeer');
    } catch {
      skipped.push('⏭️ Index idx_users_livepeer already exists or failed');
    }
    const finalTablesResult = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    const finalTables = finalTablesResult.rows.map(row => row.table_name as string);
    
    console.log('✅ Database update completed successfully!');
    
    return NextResponse.json({
      success: true,
      message: `Database selectively updated! Completed ${results.length} actions, skipped ${skipped.length} existing items.`,
      actions_taken: results,
      items_skipped: skipped,
      final_status: {
        total_tables: finalTables.length,
        tables: finalTables,
        has_stream_sessions: finalTables.includes('stream_sessions'),
        has_chat_messages: finalTables.includes('chat_messages'),
        has_stream_viewers: finalTables.includes('stream_viewers'),
        ready_for_streaming: finalTables.includes('stream_sessions')
      },
      summary: {
        actions_completed: results.length,
        items_skipped: skipped.length,
        critical_table_exists: finalTables.includes('stream_sessions'),
        database_ready: finalTables.includes('stream_sessions') && finalTables.includes('users')
      }
    });
    
  } catch (error) {
    console.error('❌ Database update error:', error);
    
    // Simple error handling
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? error.stack : 'No stack trace';
    
    return NextResponse.json(
      {
        error: "Failed to update database",
        details: errorMessage,
        stack: errorDetails
      },
      { status: 500 }
    );
  }
}