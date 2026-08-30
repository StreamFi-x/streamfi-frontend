import { NextRequest, NextResponse } from "next/server";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { toggleCommandSchema } from "../schema";
import { commandStore } from "../store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const bodyResult = await validateBody(req, toggleCommandSchema);
  if (bodyResult instanceof NextResponse) {return bodyResult;}

  const { creator_id, command_id, enabled } = bodyResult.data;

  const commands = commandStore[creator_id] ?? [];
  const command = commands.find((c) => c.id === command_id);

  if (!command) {
    return NextResponse.json(
      { error: `Command '${command_id}' not found` },
      { status: 404 }
    );
  }

  command.enabled = enabled;
  return NextResponse.json({ command });
}
