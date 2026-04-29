import { NextRequest, NextResponse } from "next/server";

type Mode = "sides" | "vertices";
type Vertex = [number, number];

interface SidesBody {
  mode: "sides";
  sides: [number, number, number];
}

interface VerticesBody {
  mode: "vertices";
  vertices: [Vertex, Vertex, Vertex];
}

type RequestBody = SidesBody | VerticesBody;

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function distanceBetween(a: Vertex, b: Vertex): number {
  return Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
}

function sidesFromVertices(vertices: [Vertex, Vertex, Vertex]): [number, number, number] {
  const [A, B, C] = vertices;
  return [distanceBetween(B, C), distanceBetween(A, C), distanceBetween(A, B)];
}

function isValidTriangle(a: number, b: number, c: number): boolean {
  return a + b > c && a + c > b && b + c > a;
}

function isDegenerate(a: number, b: number, c: number): boolean {
  const sides = [a, b, c].sort((x, y) => x - y);
  return Math.abs(sides[0] + sides[1] - sides[2]) < 1e-10;
}

function getType(a: number, b: number, c: number): "equilateral" | "isosceles" | "scalene" {
  const eps = 1e-9;
  if (Math.abs(a - b) < eps && Math.abs(b - c) < eps) return "equilateral";
  if (Math.abs(a - b) < eps || Math.abs(b - c) < eps || Math.abs(a - c) < eps) return "isosceles";
  return "scalene";
}

function getAngleType(angles: [number, number, number]): "acute" | "right" | "obtuse" {
  const eps = 0.01;
  for (const angle of angles) {
    if (Math.abs(angle - 90) < eps) return "right";
    if (angle > 90 + eps) return "obtuse";
  }
  return "acute";
}

function computeAngles(a: number, b: number, c: number): [number, number, number] {
  const A = toDeg(Math.acos((b * b + c * c - a * a) / (2 * b * c)));
  const B = toDeg(Math.acos((a * a + c * c - b * b) / (2 * a * c)));
  const C = 180 - A - B;
  return [A, B, C];
}

function heronArea(a: number, b: number, c: number): number {
  const s = (a + b + c) / 2;
  return Math.sqrt(s * (s - a) * (s - b) * (s - c));
}

function centroid(vertices: [Vertex, Vertex, Vertex]): { x: number; y: number } {
  return {
    x: round4((vertices[0][0] + vertices[1][0] + vertices[2][0]) / 3),
    y: round4((vertices[0][1] + vertices[1][1] + vertices[2][1]) / 3),
  };
}

function circumradius(a: number, b: number, c: number, area: number): number {
  return (a * b * c) / (4 * area);
}

function isValidVertex(v: unknown): v is Vertex {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    typeof v[0] === "number" &&
    typeof v[1] === "number" &&
    Number.isFinite(v[0]) &&
    Number.isFinite(v[1])
  );
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const mode = body.mode as Mode;

  if (mode !== "sides" && mode !== "vertices") {
    return NextResponse.json(
      { error: "mode must be 'sides' or 'vertices'." },
      { status: 400 }
    );
  }

  let sides: [number, number, number];
  let vertices: [Vertex, Vertex, Vertex] | undefined;

  if (mode === "sides") {
    const rawSides = body.sides;
    if (
      !Array.isArray(rawSides) ||
      rawSides.length !== 3 ||
      !rawSides.every((s) => typeof s === "number" && Number.isFinite(s) && s > 0)
    ) {
      return NextResponse.json(
        { error: "sides must be an array of 3 positive numbers." },
        { status: 400 }
      );
    }
    sides = rawSides as [number, number, number];
  } else {
    const rawVertices = body.vertices;
    if (!Array.isArray(rawVertices) || rawVertices.length !== 3 || !rawVertices.every(isValidVertex)) {
      return NextResponse.json(
        { error: "vertices must be an array of 3 [x, y] points." },
        { status: 400 }
      );
    }
    vertices = rawVertices as [Vertex, Vertex, Vertex];
    sides = sidesFromVertices(vertices);

    if (sides.some((s) => s <= 0)) {
      return NextResponse.json(
        { error: "Degenerate triangle: two or more vertices coincide." },
        { status: 400 }
      );
    }
  }

  const [a, b, c] = sides;

  if (!isValidTriangle(a, b, c)) {
    return NextResponse.json(
      { error: "Invalid triangle: sides do not satisfy the triangle inequality." },
      { status: 400 }
    );
  }

  if (isDegenerate(a, b, c)) {
    return NextResponse.json(
      { error: "Degenerate triangle: collinear points." },
      { status: 400 }
    );
  }

  const type = getType(a, b, c);
  const angles = computeAngles(a, b, c);
  const angleType = getAngleType(angles);
  const area = heronArea(a, b, c);
  const perimeter = a + b + c;
  const cr = circumradius(a, b, c, area);

  const result: Record<string, unknown> = {
    is_valid_triangle: true,
    type,
    angle_type: angleType,
    sides: [round4(a), round4(b), round4(c)],
    angles_deg: [round4(angles[0]), round4(angles[1]), round4(angles[2])],
    area: round4(area),
    perimeter: round4(perimeter),
    circumradius: round4(cr),
  };

  if (vertices) {
    result.centroid = centroid(vertices);
  }

  return NextResponse.json(result);
}
