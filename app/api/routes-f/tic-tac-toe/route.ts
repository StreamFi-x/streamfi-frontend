import type { NextRequest } from "next/server";
import { evaluateTicTacToe, type TicTacToeBoard } from "./_lib/ticTacToe";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  let body: { board?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const board = body?.board;
  if (!Array.isArray(board)) {
    return jsonResponse({ error: "'board' is required and must be an array of length 9" }, 400);
  }

  const result = evaluateTicTacToe(board as TicTacToeBoard);
  if (!result.valid) {
    return jsonResponse({ error: "Invalid tic-tac-toe board state" }, 400);
  }

  return jsonResponse(result);
}
