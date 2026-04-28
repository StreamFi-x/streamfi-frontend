import { POST } from "../route";
import { NextRequest } from "next/server";

type TicTacToeResponse = {
  valid: boolean;
  winner: "X" | "O" | null;
  line: number[] | null;
  status: "in_progress" | "won" | "draw" | "invalid";
  next_turn: "X" | "O" | null;
};

function makePost(body: object): NextRequest {
  return new Request("http://localhost/api/routes-f/tic-tac-toe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("POST /api/routes-f/tic-tac-toe", () => {
  it("returns in_progress for an empty board", async () => {
    const res = await POST(makePost({ board: Array(9).fill(null) }));
    expect(res.status).toBe(200);
    const data = await res.json() as TicTacToeResponse;
    expect(data.valid).toBe(true);
    expect(data.status).toBe("in_progress");
    expect(data.next_turn).toBe("X");
  });

  it("detects an X win", async () => {
    const res = await POST(makePost({ board: ["X", "X", "X", null, "O", null, "O", null, null] }));
    const data = await res.json() as TicTacToeResponse;
    expect(res.status).toBe(200);
    expect(data.valid).toBe(true);
    expect(data.winner).toBe("X");
    expect(data.line).toEqual([0, 1, 2]);
    expect(data.status).toBe("won");
    expect(data.next_turn).toBeNull();
  });

  it("detects an O win", async () => {
    const res = await POST(makePost({ board: ["X", "X", "O", "X", "O", null, "O", null, null] }));
    const data = await res.json() as TicTacToeResponse;
    expect(res.status).toBe(200);
    expect(data.valid).toBe(true);
    expect(data.winner).toBe("O");
    expect(data.line).toEqual([2, 4, 6]);
    expect(data.status).toBe("won");
    expect(data.next_turn).toBeNull();
  });

  it("detects a draw", async () => {
    const res = await POST(makePost({ board: ["X", "O", "X", "X", "O", "O", "O", "X", "X"] }));
    expect(res.status).toBe(200);
    const data = await res.json() as TicTacToeResponse;
    expect(data.valid).toBe(true);
    expect(data.status).toBe("draw");
    expect(data.winner).toBeNull();
    expect(data.next_turn).toBeNull();
  });

  it("rejects invalid boards with both winners", async () => {
    const res = await POST(makePost({ board: ["X", "X", "X", "O", "O", "O", null, null, null] }));
    expect(res.status).toBe(400);
  });

  it("rejects impossible move counts", async () => {
    const res = await POST(makePost({ board: ["O", null, null, null, null, null, null, null, null] }));
    expect(res.status).toBe(400);
  });
});
