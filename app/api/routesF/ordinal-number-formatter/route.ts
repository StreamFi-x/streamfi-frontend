import { type NextRequest, NextResponse } from "next/server";

type OrdinalSuffix = "st" | "nd" | "rd" | "th";

function getOrdinalSuffix(n: number): OrdinalSuffix {
  const abs = Math.abs(n);
  const mod100 = abs % 100;
  // 11, 12, 13 are always "th" regardless of ones digit
  if (mod100 >= 11 && mod100 <= 13) {
    return "th";
  }
  const mod10 = abs % 10;
  if (mod10 === 1) {return "st";}
  if (mod10 === 2) {return "nd";}
  if (mod10 === 3) {return "rd";}
  return "th";
}

export function toOrdinal(n: number): { ordinal: string; suffix: OrdinalSuffix } {
  const suffix = getOrdinalSuffix(n);
  return { ordinal: `${n}${suffix}`, suffix };
}

export async function GET(req: NextRequest) {
  const nParam = req.nextUrl.searchParams.get("n");

  if (!nParam) {
    return NextResponse.json(
      { error: "n query parameter is required." },
      { status: 400 }
    );
  }

  if (!/^-?\d+$/.test(nParam.trim())) {
    return NextResponse.json(
      { error: "n must be an integer." },
      { status: 400 }
    );
  }

  const n = parseInt(nParam.trim(), 10);

  if (!Number.isFinite(n)) {
    return NextResponse.json(
      { error: "n is out of safe integer range." },
      { status: 400 }
    );
  }

  return NextResponse.json(toOrdinal(n));
}
