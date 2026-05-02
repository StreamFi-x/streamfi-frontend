import { NextRequest, NextResponse } from "next/server";

const MAX_COUNT = 10_000;

type Distribution = "uniform" | "normal" | "exponential" | "poisson";

type RequestBody = {
  distribution?: unknown;
  count?: unknown;
  seed?: unknown;
  params?: unknown;
};

function createSeededRandom(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normal(rand: () => number, mean: number, stddev: number): number {
  const u1 = Math.max(rand(), Number.EPSILON);
  const u2 = rand();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z0 * stddev;
}

function poisson(rand: () => number, lambda: number): number {
  const limit = Math.exp(-lambda);
  let p = 1;
  let k = 0;
  do {
    k += 1;
    p *= Math.max(rand(), Number.EPSILON);
  } while (p > limit);
  return k - 1;
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const distribution = body.distribution as Distribution | undefined;
  const validDistributions: Distribution[] = [
    "uniform",
    "normal",
    "exponential",
    "poisson",
  ];
  if (!distribution || !validDistributions.includes(distribution)) {
    return NextResponse.json(
      {
        error:
          "distribution must be one of: uniform, normal, exponential, poisson",
      },
      { status: 400 },
    );
  }

  const count = body.count === undefined ? 1 : asFiniteNumber(body.count);
  if (count === null || !Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    return NextResponse.json(
      { error: `count must be an integer between 1 and ${MAX_COUNT}` },
      { status: 400 },
    );
  }

  const seed = body.seed === undefined ? Date.now() : asFiniteNumber(body.seed);
  if (seed === null) {
    return NextResponse.json({ error: "seed must be a finite number" }, { status: 400 });
  }
  const rand = createSeededRandom(seed);

  const params = (body.params ?? {}) as Record<string, unknown>;
  const numbers: number[] = [];

  if (distribution === "uniform") {
    const min = asFiniteNumber(params.min);
    const max = asFiniteNumber(params.max);
    if (min === null || max === null || min >= max) {
      return NextResponse.json(
        { error: "uniform params require min < max" },
        { status: 400 },
      );
    }
    for (let i = 0; i < count; i++) {
      numbers.push(min + rand() * (max - min));
    }
    return NextResponse.json({ numbers, distribution, params: { min, max } });
  }

  if (distribution === "normal") {
    const mean = asFiniteNumber(params.mean);
    const stddev = asFiniteNumber(params.stddev);
    if (mean === null || stddev === null || stddev <= 0) {
      return NextResponse.json(
        { error: "normal params require mean and stddev > 0" },
        { status: 400 },
      );
    }
    for (let i = 0; i < count; i++) {
      numbers.push(normal(rand, mean, stddev));
    }
    return NextResponse.json({ numbers, distribution, params: { mean, stddev } });
  }

  if (distribution === "exponential") {
    const lambda = asFiniteNumber(params.lambda);
    if (lambda === null || lambda <= 0) {
      return NextResponse.json(
        { error: "exponential params require lambda > 0" },
        { status: 400 },
      );
    }
    for (let i = 0; i < count; i++) {
      const u = Math.max(rand(), Number.EPSILON);
      numbers.push(-Math.log(1 - u) / lambda);
    }
    return NextResponse.json({ numbers, distribution, params: { lambda } });
  }

  const lambda = asFiniteNumber(params.lambda);
  if (lambda === null || lambda <= 0) {
    return NextResponse.json(
      { error: "poisson params require lambda > 0" },
      { status: 400 },
    );
  }
  for (let i = 0; i < count; i++) {
    numbers.push(poisson(rand, lambda));
  }
  return NextResponse.json({ numbers, distribution, params: { lambda } });
}
