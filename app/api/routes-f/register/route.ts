import { NextResponse } from "next/server";
import { defineSchema, parseRequestBody } from "../_lib/schema";

const registerSchema = defineSchema({
  wallet: { type: "string", minLength: 3, maxLength: 120 },
  email: { type: "string", minLength: 5, maxLength: 320 },
  age: { type: "number", min: 13, max: 120, integer: true, optional: true },
  marketingOptIn: { type: "boolean", optional: true },
});

export async function POST(request: Request) {
  const parsed = await parseRequestBody(request, registerSchema);
  if (parsed.ok === false) {
    return parsed.response;
  }

  const { wallet, email, age, marketingOptIn } = parsed.data;

  return NextResponse.json(
    {
      ok: true,
      endpoint: "routes-f/register",
      user: {
        wallet,
        email,
        age: age ?? null,
        marketingOptIn: marketingOptIn ?? false,
      },
    },
    { status: 201 }
  );
}
