import { NextResponse } from "next/server";
import { livepeerService } from "@/lib/streaming/livepeer-service";
import { sql } from "@vercel/postgres";

/**
 * GET /api/v2/streaming/health
 * Health check endpoint for the streaming service
 */
export async function GET() {
  try {
    const healthChecks: {
      timestamp: string;
      service: string;
      version: string;
      status: string;
      checks: {
        database: { status: string; message: string };
        livepeer: { status: string; message: string };
        environment: { status: string; message: string };
      };
      stats?: {
        totalUsers: number;
        totalStreams: number;
        liveStreams: number;
      };
    } = {
      timestamp: new Date().toISOString(),
      service: "StreamFi V2 Streaming API",
      version: "1.0.0",
      status: "healthy",
      checks: {
        database: { status: "unknown", message: "" },
        livepeer: { status: "unknown", message: "" },
        environment: { status: "unknown", message: "" },
      },
    };

    // Check database connectivity
    try {
      await sql`SELECT 1`;
      healthChecks.checks.database = {
        status: "healthy",
        message: "Database connection successful",
      };
    } catch (error) {
      healthChecks.checks.database = {
        status: "unhealthy",
        message: `Database connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
      healthChecks.status = "unhealthy";
    }

    // Check Livepeer service
    try {
      const isConfigured = await livepeerService.validateConfiguration();
      if (isConfigured) {
        healthChecks.checks.livepeer = {
          status: "healthy",
          message: "Livepeer service is configured and accessible",
        };
      } else {
        healthChecks.checks.livepeer = {
          status: "unhealthy",
          message: "Livepeer service is not properly configured",
        };
        healthChecks.status = "unhealthy";
      }
    } catch (error) {
      healthChecks.checks.livepeer = {
        status: "unhealthy",
        message: `Livepeer service error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
      healthChecks.status = "unhealthy";
    }

    // Check environment variables
    const requiredEnvVars = ["LIVEPEER_API_KEY", "DATABASE_URL"];
    const missingEnvVars = requiredEnvVars.filter(
      envVar => !process.env[envVar]
    );

    if (missingEnvVars.length === 0) {
      healthChecks.checks.environment = {
        status: "healthy",
        message: "All required environment variables are set",
      };
    } else {
      healthChecks.checks.environment = {
        status: "unhealthy",
        message: `Missing environment variables: ${missingEnvVars.join(", ")}`,
      };
      healthChecks.status = "unhealthy";
    }

    // Get basic statistics
    try {
      const userCount = await sql`SELECT COUNT(*) as count FROM users`;
      const streamCount =
        await sql`SELECT COUNT(*) as count FROM users WHERE livepeer_stream_id_v2 IS NOT NULL`;
      const liveCount =
        await sql`SELECT COUNT(*) as count FROM users WHERE is_live_v2 = true`;

      healthChecks.stats = {
        totalUsers: parseInt(userCount.rows[0]?.count || "0"),
        totalStreams: parseInt(streamCount.rows[0]?.count || "0"),
        liveStreams: parseInt(liveCount.rows[0]?.count || "0"),
      };
    } catch {
      // Stats are optional, don't fail the health check
      healthChecks.stats = {
        totalUsers: 0,
        totalStreams: 0,
        liveStreams: 0,
      };
    }

    const statusCode = healthChecks.status === "healthy" ? 200 : 503;

    return NextResponse.json(healthChecks, { status: statusCode });
  } catch (error) {
    console.error("Health check error:", error);

    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        service: "StreamFi V2 Streaming API",
        version: "1.0.0",
        status: "unhealthy",
        error: "Health check failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}
