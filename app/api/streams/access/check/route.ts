import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ accessRequired: false }, { status: 200 });
}

export async function POST() {
  return NextResponse.json({ accessRequired: false }, { status: 200 });
}