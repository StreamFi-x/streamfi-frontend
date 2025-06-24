/**
 * app/api/debug/livepeer-test/route.ts
 * 
 * Simple test to check if Livepeer API is working
 */

import { NextResponse } from "next/server";
import { Livepeer } from 'livepeer';

export async function GET() {
  try {
    // Check if API key exists
    if (!process.env.LIVEPEER_API_KEY) {
      return NextResponse.json(
        { 
          error: "LIVEPEER_API_KEY not found in environment variables",
          success: false
        },
        { status: 500 }
      );
    }

    // Initialize Livepeer client
    const livepeer = new Livepeer({
      apiKey: process.env.LIVEPEER_API_KEY,
    });

    // Test simple API call (list streams)
    console.log('🔍 Testing Livepeer API connection...');
    
    try {
      const streams = await livepeer.stream.getAll({ limit: 1 });
      console.log('✅ Livepeer API connection successful');
      
      return NextResponse.json({
        success: true,
        message: "Livepeer API connection successful",
        apiKeyValid: true,
        streamCount: streams.length || 0
      });
      
    } catch (livepeerError) {
      console.error('❌ Livepeer API error:', livepeerError);
      
      return NextResponse.json({
        success: false,
        error: "Livepeer API connection failed",
        details: livepeerError instanceof Error ? livepeerError.message : 'Unknown Livepeer error',
        apiKeyValid: false
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Livepeer test error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to test Livepeer connection",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}