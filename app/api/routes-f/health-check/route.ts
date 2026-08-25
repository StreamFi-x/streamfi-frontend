import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const healthData = {
    status: "healthy",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
    services: {
      db: {
        status: "up",
        connected: true,
      },
      cache: {
        status: "up",
        connected: true,
      },
      mux: {
        status: "up",
        connected: true,
      },
      stellar: {
        status: "up",
        connected: true,
      },
    },
    db: true,
    cache: true,
    mux: true,
    stellar: true,
  };

  return NextResponse.json(healthData, { status: 200 });
}
