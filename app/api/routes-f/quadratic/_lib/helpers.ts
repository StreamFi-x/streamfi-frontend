import type { QuadraticResponse, Root } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number.`);
  }
  return value;
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export function solveQuadratic(input: unknown): QuadraticResponse {
  if (!isRecord(input)) {
    throw new Error("Request body must be an object.");
  }

  const a = finiteNumber(input.a, "a");
  const b = finiteNumber(input.b, "b");
  const c = finiteNumber(input.c, "c");

  if (a === 0) {
    throw new Error("a must not be 0. For linear equations, use a linear solver.");
  }

  const discriminant = round6(b * b - 4 * a * c);
  const axisOfSymmetry = round6(-b / (2 * a));
  const vertexY = round6(c - (b * b) / (4 * a));

  let roots: Root[];
  let hasComplex: boolean;

  if (discriminant > 0) {
    const sqrtD = Math.sqrt(discriminant);
    roots = [
      { real: round6((-b + sqrtD) / (2 * a)) },
      { real: round6((-b - sqrtD) / (2 * a)) },
    ];
    hasComplex = false;
  } else if (discriminant === 0) {
    roots = [{ real: axisOfSymmetry }, { real: axisOfSymmetry }];
    hasComplex = false;
  } else {
    const sqrtAbsD = Math.sqrt(-discriminant);
    const realPart = round6(-b / (2 * a));
    const imagPart = round6(sqrtAbsD / (2 * Math.abs(a)));
    roots = [
      { real: realPart, imaginary: imagPart },
      { real: realPart, imaginary: -imagPart },
    ];
    hasComplex = true;
  }

  return {
    roots,
    discriminant,
    vertex: { x: axisOfSymmetry, y: vertexY },
    axis_of_symmetry: axisOfSymmetry,
    has_complex_roots: hasComplex,
  };
}
