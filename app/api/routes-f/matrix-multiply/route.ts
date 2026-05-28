import { NextRequest, NextResponse } from "next/server";

const MAX_DIMENSION = 100;

type Matrix = number[][];

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function validateMatrix(value: unknown, name: string): Matrix | string {
  if (!Array.isArray(value) || value.length === 0) {
    return `${name} must be a non-empty number matrix.`;
  }

  if (value.length > MAX_DIMENSION) {
    return `${name} cannot exceed ${MAX_DIMENSION} rows.`;
  }

  const firstRow = value[0];
  if (!Array.isArray(firstRow) || firstRow.length === 0) {
    return `${name} must contain non-empty rows.`;
  }

  const columnCount = firstRow.length;
  if (columnCount > MAX_DIMENSION) {
    return `${name} cannot exceed ${MAX_DIMENSION} columns.`;
  }

  for (const row of value) {
    if (!Array.isArray(row) || row.length !== columnCount) {
      return `${name} must be rectangular.`;
    }

    if (!row.every(cell => typeof cell === "number" && Number.isFinite(cell))) {
      return `${name} must contain only finite numbers.`;
    }
  }

  return value as Matrix;
}

function multiplyMatrices(a: Matrix, b: Matrix): Matrix {
  const rows = a.length;
  const inner = b.length;
  const columns = b[0].length;
  const result: Matrix = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => 0)
  );

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      let sum = 0;
      for (let i = 0; i < inner; i += 1) {
        sum += a[row][i] * b[i][col];
      }
      result[row][col] = sum;
    }
  }

  return result;
}

export async function POST(req: NextRequest) {
  let body: { a?: unknown; b?: unknown };

  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const a = validateMatrix(body.a, "a");
  if (typeof a === "string") {
    return badRequest(a);
  }

  const b = validateMatrix(body.b, "b");
  if (typeof b === "string") {
    return badRequest(b);
  }

  if (a[0].length !== b.length) {
    return badRequest("Matrix dimensions are incompatible for multiplication.");
  }

  const result = multiplyMatrices(a, b);

  return NextResponse.json({
    result,
    dimensions: {
      a: { rows: a.length, columns: a[0].length },
      b: { rows: b.length, columns: b[0].length },
      result: { rows: result.length, columns: result[0]?.length ?? 0 },
    },
  });
}
