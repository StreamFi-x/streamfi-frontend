export type TicTacToeMark = "X" | "O" | null;
export type TicTacToeBoard = TicTacToeMark[];

const WIN_LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export type TicTacToeResult = {
  valid: boolean;
  winner: "X" | "O" | null;
  line: number[] | null;
  status: "in_progress" | "won" | "draw" | "invalid";
  next_turn: "X" | "O" | null;
};

function getWinningLines(board: TicTacToeBoard, mark: "X" | "O"): number[] | null {
  for (const line of WIN_LINES) {
    if (line.every((index) => board[index] === mark)) {
      return line;
    }
  }
  return null;
}

export function evaluateTicTacToe(board: TicTacToeBoard): TicTacToeResult {
  if (!Array.isArray(board) || board.length !== 9) {
    return { valid: false, winner: null, line: null, status: "invalid", next_turn: null };
  }

  const counts = { X: 0, O: 0 };
  for (const value of board) {
    if (value === "X") counts.X += 1;
    else if (value === "O") counts.O += 1;
    else if (value !== null) {
      return { valid: false, winner: null, line: null, status: "invalid", next_turn: null };
    }
  }

  if (!(counts.X === counts.O || counts.X === counts.O + 1)) {
    return { valid: false, winner: null, line: null, status: "invalid", next_turn: null };
  }

  const xLine = getWinningLines(board, "X");
  const oLine = getWinningLines(board, "O");

  if (xLine && oLine) {
    return { valid: false, winner: null, line: null, status: "invalid", next_turn: null };
  }

  if (xLine && counts.X !== counts.O + 1) {
    return { valid: false, winner: null, line: null, status: "invalid", next_turn: null };
  }

  if (oLine && counts.X !== counts.O) {
    return { valid: false, winner: null, line: null, status: "invalid", next_turn: null };
  }

  const winner = xLine ? "X" : oLine ? "O" : null;
  const status = winner ? "won" : board.includes(null) ? "in_progress" : "draw";
  const next_turn = status === "in_progress" ? (counts.X === counts.O ? "X" : "O") : null;

  return { valid: true, winner, line: winner ? xLine ?? oLine : null, status, next_turn };
}
