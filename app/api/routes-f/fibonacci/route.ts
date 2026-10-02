import { NextResponse } from "next/server";

type Mode = "count" | "until";
type Format = "array" | "nth";

type Body = {
  mode?: Mode;
  n?: number;
  max?: number | string;
  format?: Format;
};

function fibBigInt(n: number): bigint {
  if (n <= 0) {
    throw new Error("n must be >= 1");
  }
  if (n <= 2) {
    return BigInt(1);
  }
  let a = BigInt(1);
  let b = BigInt(1);
  for (let i = 3; i <= n; i += 1) {
    const c = a + b;
    a = b;
    b = c;
  }
  return b;
}

function fibBinetSmall(n: number): number {
  const sqrt5 = Math.sqrt(5);
  const phi = (1 + sqrt5) / 2;
  return Math.round((phi ** n - (-phi) ** -n) / sqrt5);
}

export function fibNth(n: number): bigint {
  // Binet is fast but starts drifting for larger n due to floating-point rounding.
  return n <= 70 ? BigInt(fibBinetSmall(n)) : fibBigInt(n);
}

export function fibCount(n: number): bigint[] {
  const seq: bigint[] = [];
  for (let i = 1; i <= n; i += 1) {
    seq.push(fibNth(i));
  }
  return seq;
}

function parsePositiveBigInt(value: unknown): bigint | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return BigInt(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value) && value !== "0") {
    return BigInt(value);
  }
  return null;
}

export function fibUntil(max: bigint): bigint[] {
  const seq: bigint[] = [];
  let a = BigInt(1);
  let b = BigInt(1);
  while (a <= max) {
    seq.push(a);
    const next = a + b;
    a = b;
    b = next;
  }
  return seq;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const mode = body.mode;
  const format: Format = body.format ?? "array";
  if (mode !== "count" && mode !== "until") {
    return NextResponse.json(
      { error: "mode must be count or until." },
      { status: 400 }
    );
  }
  if (format !== "array" && format !== "nth") {
    return NextResponse.json(
      { error: "format must be array or nth." },
      { status: 400 }
    );
  }

  if (mode === "count") {
    const n = body.n;
    if (!Number.isInteger(n) || (n as number) < 1 || (n as number) > 10000) {
      return NextResponse.json(
        { error: "n must be an integer in [1, 10000]." },
        { status: 400 }
      );
    }
    const seq = fibCount(n as number);
    if (format === "nth") {
      return NextResponse.json({
        mode,
        format,
        n,
        value: seq[seq.length - 1].toString(),
      });
    }
    return NextResponse.json({
      mode,
      format,
      n,
      sequence: seq.map(v => v.toString()),
    });
  }

  const max = parsePositiveBigInt(body.max);
  if (max === null) {
    return NextResponse.json(
      { error: "max must be a positive integer." },
      { status: 400 }
    );
  }

  const seq = fibUntil(max);
  if (format === "nth") {
    return NextResponse.json({
      mode,
      format,
      max: max.toString(),
      value: (seq[seq.length - 1] ?? BigInt(0)).toString(),
    });
  }
  return NextResponse.json({
    mode,
    format,
    max: max.toString(),
    sequence: seq.map(v => v.toString()),
  });
}
