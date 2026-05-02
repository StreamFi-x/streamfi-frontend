import { sql } from "@vercel/postgres";
import { Redis } from "@upstash/redis";
import type { DependencyProbe, ProbeResult } from "./types";

function missingConfig(details: string): ProbeResult {
  return {
    ok: false,
    details,
  };
}

async function databaseProbe(): Promise<ProbeResult> {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    return missingConfig("Database credentials are not configured");
  }

  await sql`SELECT 1`;

  return {
    ok: true,
    details: "Database query succeeded",
  };
}

async function muxProbe(): Promise<ProbeResult> {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;

  if (!tokenId || !tokenSecret) {
    return missingConfig("Mux credentials are not configured");
  }

  const authorization = Buffer.from(`${tokenId}:${tokenSecret}`).toString(
    "base64"
  );

  const response = await fetch("https://api.mux.com/video/v1/assets?limit=1", {
    headers: {
      Authorization: `Basic ${authorization}`,
    },
  });

  if (!response.ok) {
    return {
      ok: false,
      details: `Mux probe failed with ${response.status}`,
    };
  }

  return {
    ok: true,
    details: "Mux API responded successfully",
  };
}

async function redisProbe(): Promise<ProbeResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return missingConfig("Redis credentials are not configured");
  }

  const redis = new Redis({ url, token });
  const result = await redis.ping();

  return {
    ok: result === "PONG",
    details:
      result === "PONG"
        ? "Redis ping succeeded"
        : `Unexpected Redis response: ${String(result)}`,
  };
}

export const defaultDependencyProbes: DependencyProbe[] = [
  { name: "database", run: databaseProbe },
  { name: "mux", run: muxProbe },
  { name: "redis", run: redisProbe },
];
