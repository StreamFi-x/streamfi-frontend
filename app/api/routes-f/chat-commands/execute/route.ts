import { NextRequest, NextResponse } from "next/server";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { executeCommandSchema } from "../schema";
import { commandStore, interpolate } from "../store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const bodyResult = await validateBody(req, executeCommandSchema);
  if (bodyResult instanceof NextResponse) return bodyResult;

  const { creator_id, trigger, context } = bodyResult.data;

  const commands = commandStore[creator_id] ?? [];
  const command = commands.find((c) => c.trigger === trigger);

  if (!command) {
    return NextResponse.json(
      { error: `Command '${trigger}' not found` },
      { status: 404 }
    );
  }

  if (!command.enabled) {
    return NextResponse.json(
      { error: `Command '${trigger}' is disabled` },
      { status: 403 }
    );
  }

  const response = interpolate(command.response_template, context);

  return NextResponse.json({
    response,
    trigger: command.trigger,
    cooldown_seconds: command.cooldown_seconds,
  });
}
