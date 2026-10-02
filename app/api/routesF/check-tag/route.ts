import { NextResponse } from "next/server";
import { categoryForTag } from "../tag-policy/tag-map";
import { getPolicy } from "../tag-policy/store";
import { CheckTagResponse } from "../tag-policy/types";

export async function POST(
  request: Request
): Promise<NextResponse<CheckTagResponse | { error: string }>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { creator_id, tag } = (body ?? {}) as {
    creator_id?: unknown;
    tag?: unknown;
  };

  if (typeof creator_id !== "string" || creator_id.trim() === "") {
    return NextResponse.json(
      { error: "Missing required field: creator_id" },
      { status: 400 }
    );
  }

  if (typeof tag !== "string" || tag.trim() === "") {
    return NextResponse.json(
      { error: "Missing required field: tag" },
      { status: 400 }
    );
  }

  const category = categoryForTag(tag);

  // An unmapped tag has no category to check against, so it is never allowed.
  if (!category) {
    return NextResponse.json({ allowed: false, category: null, tag });
  }

  const policy = getPolicy(creator_id);

  return NextResponse.json({
    allowed: policy.allowed_categories.includes(category),
    category,
    tag,
  });
}
