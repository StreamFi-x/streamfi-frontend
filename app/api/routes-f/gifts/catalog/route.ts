import { NextResponse } from "next/server";
import { GIFT_CATALOG } from "../_lib/db";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    catalog: GIFT_CATALOG,
  });
}
