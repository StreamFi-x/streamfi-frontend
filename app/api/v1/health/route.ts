import { CURRENT_API_VERSION, SUPPORTED_API_VERSIONS, apiV1 } from "@/lib/api";
import { getStellarNetworkGuardState } from "@/lib/stellar/config";

export async function GET() {
  const guard = getStellarNetworkGuardState();

  return apiV1.success(
    {
      status: "ok",
      apiVersion: CURRENT_API_VERSION,
      supportedVersions: [...SUPPORTED_API_VERSIONS],
      stellar: {
        network: guard.network,
        deploymentContext: guard.deploymentContext,
        mainnetGuardActive: guard.isUnsafeMainnetConfig,
        transactionsBlocked: guard.isTransactionBlocked,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST() {
  return apiV1.methodNotAllowed("GET");
}
