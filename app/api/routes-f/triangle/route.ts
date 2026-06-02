import { type NextRequest, NextResponse } from "next/server";

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function degFromRad(r: number): number {
  return round6((r * 180) / Math.PI);
}

function solveFromSides(sides: [number, number, number]) {
  const [a, b, c] = sides;

  if (a + b <= c || a + c <= b || b + c <= a) {
    throw new Error("Sides do not satisfy the triangle inequality.");
  }

  const perimeter = round6(a + b + c);
  const s = perimeter / 2;
  const area = round6(Math.sqrt(s * (s - a) * (s - b) * (s - c)));

  if (area <= 0) throw new Error("Degenerate triangle (zero area).");

  // Angles via law of cosines
  const A = degFromRad(Math.acos((b * b + c * c - a * a) / (2 * b * c)));
  const B = degFromRad(Math.acos((a * a + c * c - b * b) / (2 * a * c)));
  const C = round6(180 - A - B);

  const angles_deg = [A, B, C];
  const maxAngle = Math.max(A, B, C);

  const angle_type =
    Math.abs(maxAngle - 90) < 0.0001 ? "right" : maxAngle > 90 ? "obtuse" : "acute";

  const type =
    a === b && b === c
      ? "equilateral"
      : a === b || b === c || a === c
      ? "isosceles"
      : "scalene";

  const circumradius = round6((a * b * c) / (4 * area));
  const inradius = round6(area / s);

  return {
    is_valid_triangle: true,
    type,
    angle_type,
    angles_deg,
    perimeter,
    area,
    circumradius,
    inradius,
  };
}

function vertexDistance(p1: [number, number], p2: [number, number]): number {
  return Math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
  }

  const { mode, sides, vertices } = body as Record<string, unknown>;

  if (mode !== "sides" && mode !== "vertices") {
    return NextResponse.json({ error: "mode must be 'sides' or 'vertices'." }, { status: 400 });
  }

  try {
    if (mode === "sides") {
      if (!Array.isArray(sides) || sides.length !== 3 || sides.some((s) => typeof s !== "number" || s <= 0)) {
        return NextResponse.json(
          { error: "sides must be an array of 3 positive numbers." },
          { status: 400 }
        );
      }
      return NextResponse.json(solveFromSides(sides as [number, number, number]));
    }

    // vertices mode
    if (
      !Array.isArray(vertices) ||
      vertices.length !== 3 ||
      vertices.some((v) => !Array.isArray(v) || v.length !== 2 || v.some((c) => typeof c !== "number"))
    ) {
      return NextResponse.json(
        { error: "vertices must be an array of 3 [x, y] pairs." },
        { status: 400 }
      );
    }

    const [p0, p1, p2] = vertices as [number, number][];

    // Check for collinear points using exact cross product (avoids float rounding issues)
    const crossProduct =
      p0[0] * (p1[1] - p2[1]) +
      p1[0] * (p2[1] - p0[1]) +
      p2[0] * (p0[1] - p1[1]);
    if (crossProduct === 0) {
      throw new Error("Degenerate triangle: vertices are collinear.");
    }

    const a = round6(vertexDistance(p1, p2));
    const b = round6(vertexDistance(p0, p2));
    const c = round6(vertexDistance(p0, p1));

    const result = solveFromSides([a, b, c]);
    const centroid = {
      x: round6((p0[0] + p1[0] + p2[0]) / 3),
      y: round6((p0[1] + p1[1] + p2[1]) / 3),
    };

    return NextResponse.json({ ...result, centroid });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid triangle.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
