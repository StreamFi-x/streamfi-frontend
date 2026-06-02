import { type NextRequest, NextResponse } from "next/server";
import { getStatusByCode, getStatusesByCategory, findNearestStatus } from "./data";

export async function GET(req: NextRequest) {
  const codeParam = new URL(req.url).searchParams.get("code");

  if (!codeParam) {
    return NextResponse.json(getStatusesByCategory());
  }

  const code = Number(codeParam);
  if (!Number.isInteger(code) || isNaN(code)) {
    return NextResponse.json({ error: "Invalid status code format" }, { status: 400 });
  }

  const status = getStatusByCode(code);
  if (!status) {
    const nearest = findNearestStatus(code);
    return NextResponse.json(
      {
        error: `HTTP status code ${code} not found`,
        suggestion: nearest ? `Did you mean ${nearest.code} (${nearest.name})?` : undefined,
      },
      { status: 404 }
    );
  }

  return NextResponse.json(status);
}
