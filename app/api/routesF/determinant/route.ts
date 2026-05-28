import { type NextRequest, NextResponse } from "next/server";
import { determinant } from "./lu";

const MAX_SIZE = 10;

type DeterminantBody = {
  matrix?: unknown;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function isValidMatrix(matrix: unknown): matrix is number[][] {
  if (!Array.isArray(matrix) || matrix.length === 0 || matrix.length > MAX_SIZE) {
    return false;
  }

  const width = matrix[0]?.length;
  if (!Number.isInteger(width) || width === 0 || width > MAX_SIZE) {
    return false;
  }

  return matrix.every(
    (row) =>
      Array.isArray(row) &&
      row.length === width &&
      row.every((value) => typeof value === "number" && Number.isFinite(value))
  );
}

export async function POST(req: NextRequest) {
  let body: DeterminantBody;

  try {
    body = (await req.json()) as DeterminantBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  if (!isValidMatrix(body.matrix)) {
    return badRequest("matrix must be a square array of finite numbers with size at most 10.");
  }

  const n = body.matrix.length;
  if (body.matrix.some((row) => row.length !== n)) {
    return badRequest("matrix must be square.");
  }

  return NextResponse.json({ determinant: determinant(body.matrix) });
}
