import { NextRequest, NextResponse } from "next/server";
import { generateMagicSquare, getMagicConstant } from "./generate";

type MagicSquareBody = {
  mode?: unknown;
  matrix?: unknown;
  n?: unknown;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function parseOrder(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null;
  }

  return value;
}

function isNumericMatrix(matrix: unknown): matrix is number[][] {
  return (
    Array.isArray(matrix) &&
    matrix.length > 0 &&
    matrix.every(
      row =>
        Array.isArray(row) &&
        row.length === matrix.length &&
        row.every(value => typeof value === "number" && Number.isFinite(value))
    )
  );
}

function validateMagicSquare(matrix: number[][]) {
  const size = matrix.length;
  const target = matrix[0].reduce((sum, value) => sum + value, 0);

  for (const row of matrix) {
    const rowSum = row.reduce((sum, value) => sum + value, 0);
    if (rowSum !== target) {
      return { is_magic: false, magic_constant: target };
    }
  }

  for (let col = 0; col < size; col++) {
    let colSum = 0;
    for (let row = 0; row < size; row++) {
      colSum += matrix[row][col];
    }
    if (colSum !== target) {
      return { is_magic: false, magic_constant: target };
    }
  }

  let diagonalLeft = 0;
  let diagonalRight = 0;

  for (let i = 0; i < size; i++) {
    diagonalLeft += matrix[i][i];
    diagonalRight += matrix[i][size - 1 - i];
  }

  return {
    is_magic: diagonalLeft === target && diagonalRight === target,
    magic_constant: target,
  };
}

export async function POST(req: NextRequest) {
  let body: MagicSquareBody;

  try {
    body = (await req.json()) as MagicSquareBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  if (body.mode === "validate") {
    if (!isNumericMatrix(body.matrix)) {
      return badRequest("matrix must be a non-empty square matrix of numbers.");
    }

    return NextResponse.json(validateMagicSquare(body.matrix));
  }

  if (body.mode === "generate") {
    const order = parseOrder(body.n);
    if (order === null || order <= 0) {
      return badRequest("n must be a positive integer.");
    }

    if (order % 2 === 0) {
      return badRequest("Only odd-order magic squares are supported.");
    }

    return NextResponse.json({
      matrix: generateMagicSquare(order),
      magic_constant: getMagicConstant(order),
    });
  }

  return badRequest("mode must be either 'validate' or 'generate'.");
}
