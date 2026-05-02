import { NextResponse } from "next/server";
import { totalAsks } from "../route";

export async function GET() {
  return NextResponse.json({ total_asks: totalAsks });
}
