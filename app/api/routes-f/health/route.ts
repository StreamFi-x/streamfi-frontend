import { NextResponse } from "next/server";
import { buildHealthReport } from "./_lib/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const report = await buildHealthReport();

  return NextResponse.json(report, {
    status: report.status === "ok" ? 200 : 503,
  });
}
