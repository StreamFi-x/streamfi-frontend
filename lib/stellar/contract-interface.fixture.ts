/**
 * Frontend contract/Soroban interface assumptions.
 *
 * This file is the source-of-truth fixture for contract method signatures and
 * return shapes the frontend depends on. CI runs tests that validate these
 * assumptions against frontend implementation adapters. If a contract changes
 * upstream, update this fixture and the frontend adapter/tests in the same PR.
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
