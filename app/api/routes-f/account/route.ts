import { defineSchema, parseRequestBody } from "../_lib/schema";
import { jsonResponse } from "@/lib/routes-f/version";

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

  return jsonResponse(
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
