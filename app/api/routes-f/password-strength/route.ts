import { NextRequest, NextResponse } from "next/server";
import { calculatePasswordStrength } from "./_lib/helpers";

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    if (typeof password !== "string") {
      return NextResponse.json(
        { error: "Password must be a string." },
        { status: 400 }
      );
    }

    // Never log the password variable. 
    // Only perform the calculation and return the result.
    const result = calculatePasswordStrength(password);

    return NextResponse.json(result);
  } catch (error) {
    // Log the error but NOT the request body or password
    console.error("[Password Strength API Error]");
    return NextResponse.json(
      { error: "Failed to process password strength." },
      { status: 500 }
    );
  }
}