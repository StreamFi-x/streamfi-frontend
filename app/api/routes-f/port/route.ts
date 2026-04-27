import { NextRequest, NextResponse } from "next/server";
import { lookupByPort, lookupByService } from "./ports-data";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const portParam = searchParams.get("port");
  const serviceParam = searchParams.get("service");

  if (!portParam && !serviceParam) {
    return NextResponse.json(
      { error: "Provide either ?port=<number> or ?service=<name>" },
      { status: 400 },
    );
  }

  if (portParam !== null) {
    const port = parseInt(portParam, 10);
    if (isNaN(port) || port < 0 || port > 65535) {
      return NextResponse.json(
        { error: "Port must be an integer in the range [0, 65535]" },
        { status: 400 },
      );
    }

    const entry = lookupByPort(port);
    if (!entry) {
      return NextResponse.json(
        { error: `No well-known service found for port ${port}` },
        { status: 404 },
      );
    }

    return NextResponse.json({
      port: entry.port,
      protocols: entry.protocols,
      service: entry.service,
      description: entry.description,
      ...(entry.references ? { references: entry.references } : {}),
    });
  }

  const entry = lookupByService(serviceParam!);
  if (!entry) {
    return NextResponse.json(
      { error: `No well-known port found for service '${serviceParam}'` },
      { status: 404 },
    );
  }

  return NextResponse.json({
    port: entry.port,
    protocols: entry.protocols,
    service: entry.service,
    description: entry.description,
    ...(entry.references ? { references: entry.references } : {}),
  });
}
