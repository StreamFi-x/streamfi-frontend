import { NextResponse } from "next/server";
import { defineSchema, parseRequestBody } from "../_lib/schema";

const accountSchema = defineSchema({
  wallet: { type: "string", minLength: 3, maxLength: 120 },
  displayName: { type: "string", minLength: 1, maxLength: 60 },
  notificationsEnabled: { type: "boolean", optional: true },
});

export async function PATCH(request: Request) {
  const parsed = await parseRequestBody(request, accountSchema);
  if (parsed.ok === false) {
    return parsed.response;
  }

  const { wallet, displayName, notificationsEnabled } = parsed.data;

  return NextResponse.json(
    {
      ok: true,
      endpoint: "routes-f/account",
      account: {
        wallet,
        displayName,
        notificationsEnabled: notificationsEnabled ?? true,
      },
    },
    { status: 200 }
  );
}
