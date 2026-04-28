import { NextRequest } from "next/server";
import { buildFizzBuzzResponse, parseFizzBuzzRequest } from "./_lib/helpers";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  try {
    const { start, end, rules } = parseFizzBuzzRequest(body);
    const output = buildFizzBuzzResponse({ start, end, rules });
    return jsonResponse({ output }, 200);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Invalid request." },
      400
    );
  }
}
