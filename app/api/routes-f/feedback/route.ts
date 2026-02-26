import { defineSchema, parseRequestBody } from "../_lib/schema";
import { jsonResponse } from "@/lib/routes-f/version";

const feedbackSchema = defineSchema({
  wallet: { type: "string", minLength: 3, maxLength: 120 },
  message: { type: "string", minLength: 1, maxLength: 500 },
  rating: { type: "number", min: 1, max: 5, integer: true },
  anonymous: { type: "boolean", optional: true },
});

export async function POST(request: Request) {
  const parsed = await parseRequestBody(request, feedbackSchema);
  if (parsed.ok === false) {
    return parsed.response;
  }

  const { wallet, message, rating, anonymous } = parsed.data;

  return jsonResponse(
    {
      ok: true,
      endpoint: "routes-f/feedback",
      feedback: {
        wallet,
        message,
        rating,
        anonymous: anonymous ?? false,
      },
    },
    { status: 200 }
  );
}
