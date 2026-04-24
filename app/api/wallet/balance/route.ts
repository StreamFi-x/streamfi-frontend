import { NextResponse } from "next/server";
import * as StellarSdk from "@stellar/stellar-sdk";
import { getHorizonUrl, getStellarNetwork } from "@/lib/stellar/config";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (!address || !address.startsWith("G") || address.length !== 56) {
    return NextResponse.json(
      { error: "Invalid Stellar address" },
      { status: 400 }
    );
  }

  try {
    const network = getStellarNetwork();
    const server = new StellarSdk.Horizon.Server(getHorizonUrl(network));
    const account = await server.accounts().accountId(address).call();

    const native = (account.balances as any[]).find(
      b => b.asset_type === "native"
    );

    return NextResponse.json(
      { balance: native?.balance ?? "0" },
      {
        headers: { "Cache-Control": "private, max-age=5" },
      }
    );
  } catch (error: any) {
    if (error?.response?.status === 404) {
      // Account exists but has never been funded (below minimum reserve)
      return NextResponse.json({ balance: "0", unfunded: true });
    }
    console.error("Balance fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch balance" },
      { status: 500 }
    );
  }
}
