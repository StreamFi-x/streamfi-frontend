import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Password-protected stream access is not configured." },
    { status: 501 }
  );
}
