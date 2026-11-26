/**
 * Frontend contract/Soroban interface assumptions (#1700).
 *
 * This file is the source-of-truth fixture for contract method signatures and
 * return shapes the frontend depends on. `.github/workflows/ci.yml` runs
 * `npm run test:ci`, so `contract-interface.test.ts` fails CI when this fixture
 * no longer matches the adapter assumptions encoded in the tests. If a contract
 * changes upstream, update this fixture and the frontend adapter in the same PR.
 */
export const STREAMFI_CONTRACT_INTERFACE = {
  version: 1,
  contracts: {
    tipping: {
      methods: {
        // Horizon/Soroban payment flow assumptions used by lib/stellar/payments.ts
        buildTipTransaction: {
          args: {
            sourcePublicKey: "string",
            destinationPublicKey: "string",
            amount: "string",
            network: ["testnet", "mainnet"],
          },
          returns: {
            type: "StellarTransaction",
            requiredMethods: ["toXDR", "sign"],
          },
        },
        submitTransaction: {
          args: {
            signedTransaction: "StellarTransaction",
            network: ["testnet", "mainnet"],
          },
          returns: {
            success: "boolean",
            hash: "string?",
            ledger: "number?",
            error: "string?",
            resultCode: "string?",
          },
        },
      },
    },
  },
} as const;

export type StreamfiContractInterface = typeof STREAMFI_CONTRACT_INTERFACE;

/** Structural guard used by tests to detect a breaking mock/fixture change. */
export function isContractInterfaceCompatible(
  candidate: unknown
): candidate is StreamfiContractInterface {
  return JSON.stringify(candidate) === JSON.stringify(STREAMFI_CONTRACT_INTERFACE);
}
