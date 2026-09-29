import { NextResponse } from "next/server";
import {
  CircuitOpenError,
  DownstreamTimeoutError,
} from "@/lib/resilience/circuit-breaker";
import { getNativeBalance, STELLAR_ADDRESS } from "@/lib/stellar/balance";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (!address || !STELLAR_ADDRESS.test(address)) {
    return NextResponse.json(
      { error: "Invalid Stellar address" },
      { status: 400 }
    );
  }

  try {
    const { balance, activated } = await getNativeBalance(address);
    if (!activated) {
      // The account has never been funded (below minimum reserve).
      return NextResponse.json({ balance: "0", unfunded: true });
    }
    return NextResponse.json(
      { balance },
      {
        headers: { "Cache-Control": "private, max-age=5" },
      }
    );
  } catch (error) {
    if (
      error instanceof CircuitOpenError ||
      error instanceof DownstreamTimeoutError
    ) {
      const retryAfter =
        error instanceof CircuitOpenError
          ? Math.max(1, Math.ceil(error.retryAfterMs / 1000))
          : 5;
      return NextResponse.json(
        { error: "The Stellar network is not responding", retryAfter },
        { status: 503, headers: { "Retry-After": String(retryAfter) } }
      );
    }
    console.error("Balance fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch balance" },
      { status: 500 }
    );
  }
}
