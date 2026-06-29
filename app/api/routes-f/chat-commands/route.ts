/**
 * GET  /api/routes-f/chat-commands?creator_id=
 *   Returns [{ id, trigger, response_template, cooldown_seconds, enabled }]
 *
 * POST /api/routes-f/chat-commands
 *   Body: { creator_id, trigger, response_template, cooldown_seconds?, enabled? }
 *   Adds a new command to a creator's command list.
 *
 * POST /api/routes-f/chat-commands/execute
 *   Body: { creator_id, trigger, context? }
 *   Executes a command (resolves template variables) and returns the response string.
 *
 * POST /api/routes-f/chat-commands/toggle
 *   Body: { creator_id, command_id, enabled }
 *   Enables or disables a chat command.
 *
 * Scope: all files live inside app/api/routes-f/chat-commands/
 */

import { NextRequest, NextResponse } from "next/server";
import { validateQuery, validateBody } from "@/app/api/routes-f/_lib/validate";
import { querySchema, addCommandSchema } from "./schema";
import { commandStore } from "./store";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, querySchema);
  if (queryResult instanceof NextResponse) return queryResult;

  const { creator_id } = queryResult.data;

  const commands = commandStore[creator_id] ?? [];
  return NextResponse.json({ commands });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const bodyResult = await validateBody(req, addCommandSchema);
  if (bodyResult instanceof NextResponse) return bodyResult;

  const { creator_id, trigger, response_template, cooldown_seconds, enabled } =
    bodyResult.data;

  if (!commandStore[creator_id]) {
    commandStore[creator_id] = [];
  }

  const existing = commandStore[creator_id].find((c) => c.trigger === trigger);
  if (existing) {
    return NextResponse.json(
      { error: `Command '${trigger}' already exists` },
      { status: 409 }
    );
  }

  const id = `cmd_${Date.now()}`;
  const newCommand = {
    id,
    trigger,
    response_template,
    cooldown_seconds: cooldown_seconds ?? 5,
    enabled: enabled ?? true,
  };

  commandStore[creator_id].push(newCommand);
  return NextResponse.json({ command: newCommand }, { status: 201 });
}
