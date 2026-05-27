import { type NextRequest, NextResponse } from "next/server";
import { chatRules } from "./_schemas/chat";
import { giftRules } from "./_schemas/gift";
import { streamRules } from "./_schemas/stream";
import { userRules } from "./_schemas/user";

const ALL_RULES = {
  user: userRules,
  stream: streamRules,
  chat: chatRules,
  gift: giftRules,
};

type Scope = keyof typeof ALL_RULES;

const VALID_SCOPES = new Set<string>(Object.keys(ALL_RULES));

export async function GET(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get("scope");

  if (scope !== null) {
    if (!VALID_SCOPES.has(scope)) {
      return NextResponse.json(
        { error: `Unknown scope '${scope}'. Valid values: ${[...VALID_SCOPES].join(", ")}` },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { rules: { [scope]: ALL_RULES[scope as Scope] } },
      {
        headers: { "Cache-Control": "public, max-age=3600" },
      }
    );
  }

  return NextResponse.json(
    { rules: ALL_RULES },
    {
      headers: { "Cache-Control": "public, max-age=3600" },
    }
  );
}
