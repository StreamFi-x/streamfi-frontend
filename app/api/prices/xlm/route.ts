import { NextResponse } from "next/server";
import { getCachedXlmUsdPrice } from "@/lib/prices/xlm";

export async function GET() {
  const result = await getCachedXlmUsdPrice();
  return NextResponse.json(result, { status: 200 });
}
