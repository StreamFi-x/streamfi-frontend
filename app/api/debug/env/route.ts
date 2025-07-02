import { NextResponse } from "next/server";

export async function GET() {
  try {
    const envCheck = {
      LIVEPEER_API_KEY: !!process.env.LIVEPEER_API_KEY,
      LIVEPEER_API_KEY_LENGTH: process.env.LIVEPEER_API_KEY?.length || 0,
      LIVEPEER_API_KEY_PREVIEW:
        process.env.LIVEPEER_API_KEY?.substring(0, 8) + "...",
      POSTGRES_URL: !!process.env.POSTGRES_URL,
      NODE_ENV: process.env.NODE_ENV,
    };

    return NextResponse.json({
      success: true,
      environment: envCheck,
      message: "Environment check completed",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to check environment",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
