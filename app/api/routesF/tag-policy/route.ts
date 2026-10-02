import { NextResponse } from "next/server";
import { getPolicy, setPolicy } from "./store";
import {
  TAG_CATEGORIES,
  TagCategory,
  TagPolicyGetResponse,
  TagPolicyPutResponse,
  isTagCategory,
} from "./types";

export async function GET(
  request: Request
): Promise<NextResponse<TagPolicyGetResponse | { error: string }>> {
  const url = new URL(request.url);
  const creatorId = url.searchParams.get("creator_id");

  if (!creatorId) {
    return NextResponse.json(
      { error: "Missing required query parameter: creator_id" },
      { status: 400 }
    );
  }

  const policy = getPolicy(creatorId);
  return NextResponse.json({ allowed_categories: policy.allowed_categories });
}

export async function PUT(
  request: Request
): Promise<NextResponse<TagPolicyPutResponse | { error: string }>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { creator_id, allowed_categories } = (body ?? {}) as {
    creator_id?: unknown;
    allowed_categories?: unknown;
  };

  if (typeof creator_id !== "string" || creator_id.trim() === "") {
    return NextResponse.json(
      { error: "Missing required field: creator_id" },
      { status: 400 }
    );
  }

  if (!Array.isArray(allowed_categories)) {
    return NextResponse.json(
      { error: "Missing required field: allowed_categories (array)" },
      { status: 400 }
    );
  }

  const invalid = allowed_categories.filter(
    category => !isTagCategory(category)
  );
  if (invalid.length > 0) {
    return NextResponse.json(
      {
        error: `Invalid categories: ${invalid.join(", ")}. Valid categories: ${TAG_CATEGORIES.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const policy = setPolicy(creator_id, allowed_categories as TagCategory[]);

  return NextResponse.json({
    success: true,
    allowed_categories: policy.allowed_categories,
    updated_at: policy.updated_at,
  });
}
