import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
  rows: z.string().optional().default("5").transform(val => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 1 || num > 50) {
      throw new Error("rows must be between 1 and 50");
    }
    return num;
  })
});

// Calculate binomial coefficient using BigInt for large numbers
function binomialCoefficient(n: number, k: number): bigint {
  if (k > n || k < 0) return 0n;
  if (k === 0 || k === n) return 1n;
  
  // Use symmetry: C(n,k) = C(n,n-k)
  if (k > n - k) k = n - k;
  
  let result = 1n;
  for (let i = 0; i < k; i++) {
    result = result * BigInt(n - i) / BigInt(i + 1);
  }
  
  return result;
}

// Generate Pascal's triangle using binomial coefficients
function generatePascalTriangle(rows: number): number[][] {
  const triangle: number[][] = [];
  
  for (let n = 0; n < rows; n++) {
    const row: number[] = [];
    for (let k = 0; k <= n; k++) {
      const coefficient = binomialCoefficient(n, k);
      // Convert BigInt to number - should be safe for reasonable row counts
      row.push(Number(coefficient));
    }
    triangle.push(row);
  }
  
  return triangle;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  const validation = querySchema.safeParse({
    rows: searchParams.get("rows")
  });

  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { rows } = validation.data;
  
  try {
    const triangle = generatePascalTriangle(rows);
    
    return NextResponse.json({
      triangle,
      rows: triangle.length
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate Pascal's triangle" },
      { status: 400 }
    );
  }
}