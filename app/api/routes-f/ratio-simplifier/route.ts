import { NextRequest, NextResponse } from "next/server";

// Euclidean GCD algorithm
function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  return a;
}

// Function to find how many decimal places a number has
function getDecimalPlaces(num: number): number {
  const str = num.toString();
  const dotIndex = str.indexOf(".");
  if (dotIndex === -1) {return 0;}
  // Handle exponential notation like 1e-7
  if (str.includes("e")) {
    const parts = str.split("e");
    const exp = parseInt(parts[1], 10);
    if (exp < 0) {
      return (parts[0].split(".")[1]?.length || 0) - exp;
    }
  }
  return str.length - dotIndex - 1;
}

export async function POST(req: NextRequest) {
  let body: { numerator?: unknown; denominator?: unknown; ratio?: unknown };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  let numeratorVal: number;
  let denominatorVal: number;

  if (body.ratio !== undefined) {
    if (typeof body.ratio !== "string") {
      return NextResponse.json(
        { error: "ratio must be a string in format 'a:b'." },
        { status: 400 }
      );
    }
    const parts = body.ratio.split(":");
    if (parts.length !== 2) {
      return NextResponse.json(
        { error: "ratio must be in format 'a:b'." },
        { status: 400 }
      );
    }

    const n = Number(parts[0].trim());
    const d = Number(parts[1].trim());

    if (isNaN(n) || isNaN(d) || parts[0].trim() === "" || parts[1].trim() === "") {
      return NextResponse.json(
        { error: "Ratio components must be valid numbers." },
        { status: 400 }
      );
    }

    numeratorVal = n;
    denominatorVal = d;
  } else if (body.numerator !== undefined || body.denominator !== undefined) {
    const n = Number(body.numerator);
    const d = Number(body.denominator);

    if (
      body.numerator === undefined ||
      body.denominator === undefined ||
      isNaN(n) ||
      isNaN(d) ||
      typeof body.numerator === "boolean" ||
      typeof body.denominator === "boolean"
    ) {
      return NextResponse.json(
        { error: "numerator and denominator are required and must be valid numbers." },
        { status: 400 }
      );
    }

    numeratorVal = n;
    denominatorVal = d;
  } else {
    return NextResponse.json(
      { error: "Please provide either { numerator, denominator } or { ratio }." },
      { status: 400 }
    );
  }

  if (denominatorVal === 0) {
    return NextResponse.json(
      { error: "Denominator cannot be zero." },
      { status: 400 }
    );
  }

  if (!Number.isFinite(numeratorVal) || !Number.isFinite(denominatorVal)) {
    return NextResponse.json(
      { error: "Numerator and denominator must be finite numbers." },
      { status: 400 }
    );
  }

  // Handle float values by scaling them to integers
  const numDecimals = Math.max(
    getDecimalPlaces(numeratorVal),
    getDecimalPlaces(denominatorVal)
  );

  const multiplier = Math.pow(10, numDecimals);
  // Using Math.round to avoid tiny floating point representation issues after multiplication
  const intNum = Math.round(numeratorVal * multiplier);
  const intDen = Math.round(denominatorVal * multiplier);

  const divisor = gcd(intNum, intDen);

  let simplifiedNum = intNum / divisor;
  let simplifiedDen = intDen / divisor;

  // Standardize sign: denominator should always be positive
  if (simplifiedDen < 0) {
    simplifiedNum = -simplifiedNum;
    simplifiedDen = -simplifiedDen;
  }

  const decimalVal = numeratorVal / denominatorVal;

  return NextResponse.json({
    simplified: `${simplifiedNum}:${simplifiedDen}`,
    numerator: simplifiedNum,
    denominator: simplifiedDen,
    decimal: decimalVal,
    gcd: divisor / multiplier, // Return divisor scaled back or original GCD. If they wanted original Euclidean, divisor is excellent.
  });
}
