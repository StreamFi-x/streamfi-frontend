import { NextRequest, NextResponse } from "next/server";

const MAX_BODY_BYTES = 16_384;

export async function POST(request: NextRequest): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Report too large" }, { status: 413 });
  }

  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Report too large" }, { status: 413 });
    }
    const body = JSON.parse(rawBody);
    const reports = Array.isArray(body) ? body : [body];
    for (const report of reports.slice(0, 20)) {
      const item = report?.["csp-report"] ?? report?.body ?? report;
      console.warn("[csp-report]", JSON.stringify({
        documentUri: item?.documentURI ?? item?.documentURL,
        violatedDirective: item?.violatedDirective ?? item?.effectiveDirective,
        blockedUri: item?.blockedURI ?? item?.blockedURL,
        sourceFile: item?.sourceFile,
        lineNumber: item?.lineNumber,
      }));
    }
    return new Response(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  }
}