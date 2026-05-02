import { NextRequest, NextResponse } from "next/server";
import { getThreadById, softDeleteComment } from "../_lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const thread = getThreadById(id);

  if (!thread) {
    return NextResponse.json({ error: "Comment not found." }, { status: 404 });
  }

  return NextResponse.json({ comment: thread });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const deleted = softDeleteComment(id);

  if (!deleted) {
    return NextResponse.json({ error: "Comment not found." }, { status: 404 });
  }

  return NextResponse.json({ deleted: true, id });
}
