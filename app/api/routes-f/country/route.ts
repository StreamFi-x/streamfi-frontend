import { NextRequest, NextResponse } from "next/server";
import { countries } from "./_lib/countries";
import { findByCodeOrName } from "./_lib/search";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const name = req.nextUrl.searchParams.get("name");

  if (!code && !name) {
    return NextResponse.json({ countries, count: countries.length });
  }

  const result = findByCodeOrName(countries, code, name);
  if (!result) {
    return NextResponse.json({ error: "Country not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}
