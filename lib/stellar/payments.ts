import { Asset, BASE_FEE, Transaction, Horizon } from "@stellar/stellar-sdk";
import { buildPaymentTransaction } from "./transactions";
import { getUsdcAsset } from "./usdc";

const Server = Horizon.Server;

interface BuildTipTransactionParams {
  sourcePublicKey: string; // Viewer's Stellar wallet
  destinationPublicKey: string; // Creator's Stellar wallet
  amount: string; // XLM amount (e.g., "10.0000000")
  network: "testnet" | "mainnet";
}

interface BuildGiftTransactionParams {
  sourcePublicKey: string;
  destinationPublicKey: string;
  usdcAmount: string;
  network: "testnet" | "mainnet";
}

interface SubmitTransactionResult {
  success: boolean;
  hash?: string;
  ledger?: number;
  error?: string;
  resultCode?: string;
}

/**
 * Get Stellar Horizon server instance based on network
 */
function getServer(network: "testnet" | "mainnet"): typeof Server.prototype {
  const horizonUrl =
    network === "testnet"
      ? "https://horizon-testnet.stellar.org"
      : "https://horizon.stellar.org";

  return new Server(horizonUrl);
}

/**
 * Build a Stellar payment transaction for tipping
 * @param params - Transaction parameters including source, destination, amount, and network
 * @returns Unsigned Stellar transaction ready to be signed
 */
export async function buildTipTransaction(
  params: BuildTipTransactionParams
): Promise<Transaction> {
  const { sourcePublicKey, destinationPublicKey, amount, network } = params;

  try {
    return await buildPaymentTransaction({
      sourcePublicKey,
      destinationPublicKey,
      asset: Asset.native(),
      amount,
      memoText: "StreamFi Tip",
      network,
      timeoutSeconds: 30,
    });
  } catch (error) {
    if (error instanceof Error) {
      // Handle specific Stellar errors
      if (error.message.includes("Account not found")) {
        throw new Error(
          `Source account not found: ${sourcePublicKey}. Please ensure the account is funded.`
        );
      }
      throw new Error(`Failed to build transaction: ${error.message}`);
    }
    throw new Error("Failed to build transaction: Unknown error");
  }
}

export async function buildGiftTransaction(
  params: BuildGiftTransactionParams
): Promise<Transaction> {
  const { sourcePublicKey, destinationPublicKey, usdcAmount, network } = params;

  try {
    return await buildPaymentTransaction({
      sourcePublicKey,
      destinationPublicKey,
      asset: getUsdcAsset(network),
      amount: usdcAmount,
      memoText: "StreamFi Gift",
      network,
      timeoutSeconds: 30,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to build gift transaction: ${error.message}`);
    }
    throw new Error("Failed to build gift transaction: Unknown error");
  }
}

/**
 * Submit a signed transaction to the Stellar network
 * @param transaction - Signed Stellar transaction
 * @param network - Network to submit to (testnet or mainnet)
 * @returns Result object with success status, transaction hash, and ledger number
 */
export async function submitTransaction(
  transaction: Transaction,
  network: "testnet" | "mainnet"
): Promise<SubmitTransactionResult> {
  try {
    const server = getServer(network);

    // Submit the transaction to the network
    const response = await server.submitTransaction(transaction);

    return {
      success: true,
      hash: response.hash,
      ledger: response.ledger,
    };
  } catch (error) {
    // Handle Horizon-specific errors
    if (error && typeof error === "object" && "response" in error) {
      const horizonError = error as any;

      const resultCodes = horizonError.response?.data?.extras?.result_codes;
      const transactionCode = resultCodes?.transaction;
      const operationCodes = resultCodes?.operations;

      // Map common error codes to user-friendly messages
      let errorMessage = "Transaction failed";

      if (transactionCode === "tx_insufficient_balance") {
        errorMessage = "Insufficient XLM balance to complete the transaction";
      } else if (transactionCode === "tx_bad_seq") {
        errorMessage =
          "Transaction sequence number is invalid. Please try again";
      } else if (transactionCode === "tx_insufficient_fee") {
        errorMessage = "Transaction fee is too low";
      } else if (operationCodes?.includes("op_underfunded")) {
        errorMessage = "Insufficient funds for this payment";
      } else if (operationCodes?.includes("op_no_destination")) {
        errorMessage = "Destination account does not exist";
      } else if (operationCodes?.includes("op_line_full")) {
        errorMessage = "Destination account cannot receive more of this asset";
      }

      return {
        success: false,
        error: errorMessage,
        resultCode: transactionCode || operationCodes?.join(", "),
      };
    }

    // Generic error handling
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Unknown error occurred while submitting transaction",
    };
  }
}

/**
 * Get the current network from environment variable
 * Defaults to testnet if not set
 */
export function getCurrentNetwork(): "testnet" | "mainnet" {
  const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK;
  return network === "mainnet" ? "mainnet" : "testnet";
}

/**
 * Validate a Stellar public key format
 * @param publicKey - Public key to validate
 * @returns true if valid, false otherwise
 */
export function isValidStellarPublicKey(publicKey: string): boolean {
  // Stellar public keys start with 'G' and are 56 characters long
  return /^G[A-Z0-9]{55}$/.test(publicKey);
}

/**
 * Format XLM amount to 7 decimal places (Stellar standard)
 * @param amount - Amount to format
 * @returns Formatted amount string
 */
export function formatXLMAmount(amount: number): string {
  return amount.toFixed(7);
}

/**
 * Calculate the fee estimate for a transaction in XLM
 */
export function calculateFeeEstimate(): number {
  return (BASE_FEE as any) / 10000000;
}

/**
 * Get the current XLM price in USD
 */
export async function getXLMPrice(): Promise<number> {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd"
    );
    const data = await response.json();
    return data.stellar.usd;
  } catch (error) {
    console.error("Failed to fetch XLM price:", error);
    return 0.12; // Fallback price
  }
}

/**
 * Check if the account has insufficient balance for the payment and fee
 */
export async function hasInsufficientBalance(
  publicKey: string,
  amount: string
): Promise<boolean> {
  try {
    const network = getCurrentNetwork();
    const server = getServer(network);
    const account = await server.loadAccount(publicKey);
    const nativeBalance = account.balances.find(b => b.asset_type === "native");
    if (!nativeBalance) {
      return true;
    }

    const balance = parseFloat(nativeBalance.balance);
    const required = parseFloat(amount) + calculateFeeEstimate();
    return balance < required;
  } catch (error) {
    // If account doesn't exist, it definitely has insufficient balance
    console.error("Failed to check balance:", error);
    return true;
  }
}
