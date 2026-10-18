import {
  TransactionBuilder,
  Networks,
  Operation,
  Asset,
  BASE_FEE,
  Memo,
  Transaction,
  Horizon,
  StrKey,
  Server as StellarServer,
} from "@stellar/stellar-sdk";
import { logger } from "@/lib/tracing/logger";
import { getTraceHeaders } from "@/lib/tracing/trace-context";

const Server = Horizon.Server;

interface BuildTipTransactionParams {
  sourcePublicKey: string; // Viewer's Stellar wallet
  destinationPublicKey: string; // Creator's Stellar wallet
  amount: string; // XLM amount (e.g., "10.0000000")
  network: "testnet" | "mainnet";
  memo?: string;
  /**
   * Fee in stroops. Pass the value the balance pre-flight check used so the
   * check and the transaction agree; defaults to the current network
   * recommendation (see getRecommendedFeeStroops).
   */
  feeStroops?: number;
}

interface BuildPathPaymentParams {
  sourcePublicKey: string;
  destinationPublicKey: string;
  sendAsset: Asset; // Asset the sender pays with
  sendAmount: string; // Amount sender pays
  receiveAsset: Asset; // Asset the recipient receives
  receiveAmount: string; // Amount recipient receives
  maxSlippage: number; // Slippage tolerance as percentage (e.g., 0.5 for 0.5%)
  network: "testnet" | "mainnet";
  memo?: string;
  strict?: "send" | "receive"; // Default "send"
}

interface SubmitTransactionResult {
  success: boolean;
  hash?: string;
  ledger?: number;
  error?: string;
  resultCode?: string;
}
function getServer(network: "testnet" | "mainnet"): typeof Server.prototype {
  const horizonUrl =
    network === "testnet"
      ? "https://horizon-testnet.stellar.org"
      : "https://horizon.stellar.org";

  return new Server(horizonUrl);
}

/**
 * Get Stellar network passphrase based on network type
 */
function getNetworkPassphrase(network: "testnet" | "mainnet"): string {
  return network === "testnet" ? Networks.TESTNET : Networks.PUBLIC;
}

/**
 * Build a Stellar payment transaction for tipping
 * @param params - Transaction parameters including source, destination, amount, and network
 * @returns Unsigned Stellar transaction ready to be signed
 */
export function getUsdcAssetIssuer(network: "testnet" | "mainnet"): string {
  const fallbackIssuer =
    network === "testnet"
      ? "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
      : "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

  const configuredIssuer =
    network === "testnet"
      ? process.env.STELLAR_TESTNET_USDC_ISSUER
      : process.env.STELLAR_MAINNET_USDC_ISSUER;

  const issuer = configuredIssuer || fallbackIssuer;

  if (!StrKey.isValidEd25519PublicKey(issuer)) {
    throw new Error(`USDC issuer is invalid: ${issuer}`);
  }

  return issuer;
}

export function getUsdcAsset(network: "testnet" | "mainnet"): Asset {
  return new Asset("USDC", getUsdcAssetIssuer(network));
}

/**
 * Check if an account has a trustline to a given asset
 */
export async function hasTrustline(
  publicKey: string,
  asset: Asset,
  network: "testnet" | "mainnet"
): Promise<boolean> {
  try {
    const server = getServer(network);
    const account = await server.loadAccount(publicKey);

    // Check if the account has a trustline to the asset
    return account.balances.some(
      balance =>
        balance.asset_code === asset.code &&
        balance.asset_issuer === asset.issuer
    );
  } catch (error) {
    logger.warn("Failed to check trustline", {
      publicKey: publicKey.substring(0, 8),
      asset: asset.code,
      issuer: asset.issuer?.substring(0, 8),
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Get path for a path payment from Stellar
 * @returns Array of Asset objects representing the payment path, or null if no path found
 */
export async function findPathPaymentPath(
  sourceAsset: Asset,
  destinationAsset: Asset,
  sendAmount: string,
  network: "testnet" | "mainnet"
): Promise<Asset[] | null> {
  try {
    const server = getServer(network);
    const paths = await server
      .strictReceivePaths([sourceAsset], destinationAsset, sendAmount)
      .call();

    if (paths.records && paths.records.length > 0) {
      // Return the first (best) path
      return paths.records[0].path || [];
    }

    return null;
  } catch (error) {
    logger.warn("Failed to find path payment path", {
      sourceAsset: sourceAsset.code,
      destAsset: destinationAsset.code,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Calculate the maximum send amount with slippage tolerance
 */
function calculateMaxSendWithSlippage(
  baseAmount: string,
  maxSlippagePercent: number
): string {
  const base = parseFloat(baseAmount);
  const factor = 1 + maxSlippagePercent / 100;
  return (base * factor).toFixed(7);
}

/**
 * Calculate the minimum receive amount with slippage tolerance
 */
function calculateMinReceiveWithSlippage(
  baseAmount: string,
  maxSlippagePercent: number
): string {
  const base = parseFloat(baseAmount);
  const factor = 1 - maxSlippagePercent / 100;
  const result = (base * factor).toFixed(7);
  return result;
}

export async function buildTipTransaction(
  params: BuildTipTransactionParams
): Promise<Transaction> {
  const {
    sourcePublicKey,
    destinationPublicKey,
    amount,
    network,
    memo,
    feeStroops,
  } = params;
  const startTime = Date.now();

  try {
    logger.info("Building Stellar tip transaction", {
      operation: "buildTipTransaction",
      network,
      amount,
    });

    const server = getServer(network);
    const networkPassphrase = getNetworkPassphrase(network);

    const normalizedAmount = Number(amount);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    const sourceAccount = await server.loadAccount(sourcePublicKey);
    const fee = String(feeStroops ?? (await getRecommendedFeeStroops(network)));

    const transaction = new TransactionBuilder(sourceAccount, {
      fee,
      networkPassphrase,
    })
      .addOperation(
        Operation.payment({
          destination: destinationPublicKey,
          asset: Asset.native(),
          amount: amount,
        })
      )
      .addMemo(Memo.text((memo ?? "StreamFi Tip").slice(0, 28)))
      .setTimeout(30)
      .build();

    const durationMs = Date.now() - startTime;
    logger.info("Stellar tip transaction built", {
      operation: "buildTipTransaction",
      durationMs,
    });

    return transaction;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error("Stellar tip transaction build failed", {
      operation: "buildTipTransaction",
      durationMs,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof Error) {
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

export async function buildUsdcTipTransaction(
  params: BuildTipTransactionParams
): Promise<Transaction> {
  const {
    sourcePublicKey,
    destinationPublicKey,
    amount,
    network,
    memo,
    feeStroops,
  } = params;
  const startTime = Date.now();

  try {
    logger.info("Building Stellar USDC tip transaction", {
      operation: "buildUsdcTipTransaction",
      network,
      amount,
    });

    const server = getServer(network);
    const networkPassphrase = getNetworkPassphrase(network);

    const normalizedAmount = Number(amount);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    const sourceAccount = await server.loadAccount(sourcePublicKey);
    const asset = getUsdcAsset(network);
    const fee = String(feeStroops ?? (await getRecommendedFeeStroops(network)));

    const transaction = new TransactionBuilder(sourceAccount, {
      fee,
      networkPassphrase,
    })
      .addOperation(
        Operation.payment({
          destination: destinationPublicKey,
          asset,
          amount: amount,
        })
      )
      .addMemo(Memo.text((memo ?? "StreamFi USDC Tip").slice(0, 28)))
      .setTimeout(30)
      .build();

    const durationMs = Date.now() - startTime;
    logger.info("Stellar USDC tip transaction built", {
      operation: "buildUsdcTipTransaction",
      durationMs,
    });

    return transaction;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error("Stellar USDC tip transaction build failed", {
      operation: "buildUsdcTipTransaction",
      durationMs,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof Error) {
      if (error.message.includes("Account not found")) {
        throw new Error(
          `Source account not found: ${sourcePublicKey}. Please ensure the account is funded.`
        );
      }
      throw new Error(`Failed to build USDC transaction: ${error.message}`);
    }
    throw new Error("Failed to build USDC transaction: Unknown error");
  }
}

/**
 * Build a multi-asset path payment transaction with slippage protection
 * Supports cross-asset and cross-issuer transfers via Stellar's path payment
 */
export async function buildPathPaymentTipTransaction(
  params: BuildPathPaymentParams
): Promise<Transaction> {
  const {
    sourcePublicKey,
    destinationPublicKey,
    sendAsset,
    sendAmount,
    receiveAsset,
    receiveAmount,
    maxSlippage,
    network,
    memo,
    strict = "send",
  } = params;
  const startTime = Date.now();

  try {
    logger.info("Building path payment tip transaction", {
      operation: "buildPathPaymentTipTransaction",
      network,
      sendAsset: sendAsset.code,
      receiveAsset: receiveAsset.code,
      sendAmount,
      receiveAmount,
      maxSlippage,
      strict,
    });

    if (maxSlippage < 0 || maxSlippage > 100) {
      throw new Error("maxSlippage must be between 0 and 100");
    }

    const server = getServer(network);
    const networkPassphrase = getNetworkPassphrase(network);

    const sendNum = Number(sendAmount);
    const receiveNum = Number(receiveAmount);
    if (
      !Number.isFinite(sendNum) ||
      !Number.isFinite(receiveNum) ||
      sendNum <= 0 ||
      receiveNum <= 0
    ) {
      throw new Error("Amounts must be valid positive numbers");
    }

    // Load source account
    const sourceAccount = await server.loadAccount(sourcePublicKey);

    // Verify sender has trustline to send asset (if not native)
    if (!sendAsset.isNative()) {
      const hasSendTrustline = await hasTrustline(
        sourcePublicKey,
        sendAsset,
        network
      );
      if (!hasSendTrustline) {
        throw new Error(
          `Sender does not have a trustline to ${sendAsset.code}. Please establish the trustline first.`
        );
      }
    }

    // Verify recipient has trustline to receive asset (if not native)
    if (!receiveAsset.isNative()) {
      const hasReceiveTrustline = await hasTrustline(
        destinationPublicKey,
        receiveAsset,
        network
      );
      if (!hasReceiveTrustline) {
        throw new Error(
          `Recipient does not have a trustline to ${receiveAsset.code}. Please ask them to establish it first.`
        );
      }
    }

    // Calculate path and slippage bounds
    const path = await findPathPaymentPath(
      sendAsset,
      receiveAsset,
      receiveAmount,
      network
    );

    if (!path) {
      throw new Error(
        `No payment path found between ${sendAsset.code} and ${receiveAsset.code} within acceptable slippage`
      );
    }

    // Build the operation based on strict semantics
    let operation;
    if (strict === "send") {
      // Sender pays exactly sendAmount, recipient gets at least minReceive
      const minReceive = calculateMinReceiveWithSlippage(
        receiveAmount,
        maxSlippage
      );
      operation = Operation.pathPaymentStrictSend({
        sendAsset,
        sendAmount: sendAmount,
        destination: destinationPublicKey,
        destAsset: receiveAsset,
        destMin: minReceive,
        path,
      });

      logger.debug("Path payment strict-send configured", {
        sendAmount,
        destMin: minReceive,
        pathLength: path.length,
      });
    } else {
      // Sender pays at most maxSend, recipient receives exactly receiveAmount
      const maxSend = calculateMaxSendWithSlippage(sendAmount, maxSlippage);
      operation = Operation.pathPaymentStrictReceive({
        sendAsset,
        sendMax: maxSend,
        destination: destinationPublicKey,
        destAsset: receiveAsset,
        destAmount: receiveAmount,
        path,
      });

      logger.debug("Path payment strict-receive configured", {
        sendMax: maxSend,
        destAmount: receiveAmount,
        pathLength: path.length,
      });
    }

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(operation)
      .addMemo(Memo.text((memo ?? "StreamFi Multi-Asset Tip").slice(0, 28)))
      .setTimeout(30)
      .build();

    const durationMs = Date.now() - startTime;
    logger.info("Path payment tip transaction built", {
      operation: "buildPathPaymentTipTransaction",
      durationMs,
    });

    return transaction;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error("Path payment tip transaction build failed", {
      operation: "buildPathPaymentTipTransaction",
      durationMs,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to build path payment transaction: Unknown error");
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
  const startTime = Date.now();

  try {
    logger.info("Submitting transaction to Stellar", {
      operation: "submitTransaction",
      network,
      txHash: transaction.hash().toString("hex").substring(0, 16),
    });

    const server = getServer(network);
    const response = await server.submitTransaction(transaction);

    const durationMs = Date.now() - startTime;
    logger.info("Transaction submitted successfully", {
      operation: "submitTransaction",
      durationMs,
      hash: response.hash,
      ledger: response.ledger,
    });

    return {
      success: true,
      hash: response.hash,
      ledger: response.ledger,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error("Transaction submission failed", {
      operation: "submitTransaction",
      durationMs,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

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
export function formatXLMAmount(amount: number | string | bigint): string {
  if (typeof amount === "bigint") {
    const negative = amount < BigInt(0);
    const abs = negative ? -amount : amount;
    const whole = abs / BigInt(10_000_000);
    const fraction = (abs % BigInt(10_000_000)).toString().padStart(7, "0");
    return `${negative ? "-" : ""}${whole}.${fraction}`;
  }

  const str = String(amount).trim();
  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(str);
  if (!match) {
    const num = Number(amount);
    return isNaN(num) ? "0.0000000" : num.toFixed(7);
  }

  const [, sign, whole, fraction = ""] = match;
  const stroops =
    BigInt(whole || "0") * BigInt(10_000_000) +
    BigInt((fraction + "0000000").slice(0, 7));
  const negative = sign === "-";
  const wholePart = stroops / BigInt(10_000_000);
  const fracPart = (stroops % BigInt(10_000_000)).toString().padStart(7, "0");
  return `${negative ? "-" : ""}${wholePart}.${fracPart}`;
}

const STROOPS_PER_XLM = 10_000_000;
const BASE_FEE_STROOPS = Number(BASE_FEE);
/** feeStats() is cached this long, so typing an amount never hits Horizon. */
const FEE_CACHE_TTL_MS = 30_000;
const FEE_STATS_TIMEOUT_MS = 3_000;
/** Upper bound per operation (0.01 XLM) so a bad response cannot drain a wallet. */
const MAX_FEE_STROOPS = 100_000;

interface CachedFee {
  stroops: number;
  fetchedAt: number;
}
const feeCache = new Map<string, CachedFee>();
const feeInFlight = new Map<string, Promise<number>>();

export function resetFeeCacheForTests(): void {
  feeCache.clear();
  feeInFlight.clear();
}

async function fetchFeeStroops(
  network: "testnet" | "mainnet"
): Promise<number> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const stats = await Promise.race([
      getServer(network).feeStats(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("feeStats timed out")),
          FEE_STATS_TIMEOUT_MS
        );
      }),
    ]);
    // p90 of what recent transactions were willing to pay: high enough to be
    // included under current congestion, without bidding for the very next slot.
    const surge = Number(stats.max_fee.p90);
    const lastBase = Number(stats.last_ledger_base_fee);
    const recommended = Math.max(
      BASE_FEE_STROOPS,
      Number.isFinite(lastBase) ? lastBase : 0,
      Number.isFinite(surge) ? surge : 0
    );
    return Math.min(Math.ceil(recommended), MAX_FEE_STROOPS);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Per-operation fee, in stroops, needed to be included under current network
 * conditions. Cached for FEE_CACHE_TTL_MS and shared between concurrent
 * callers. If Horizon's feeStats cannot be read, the last known value is used,
 * else the network minimum.
 */
export async function getRecommendedFeeStroops(
  network: "testnet" | "mainnet" = getCurrentNetwork()
): Promise<number> {
  const cached = feeCache.get(network);
  if (cached && Date.now() - cached.fetchedAt < FEE_CACHE_TTL_MS) {
    return cached.stroops;
  }
  let pending = feeInFlight.get(network);
  if (!pending) {
    pending = fetchFeeStroops(network)
      .then(stroops => {
        feeCache.set(network, { stroops, fetchedAt: Date.now() });
        return stroops;
      })
      .catch(error => {
        logger.warn("Stellar fee stats unavailable, using fallback fee", {
          operation: "getRecommendedFeeStroops",
          network,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        // Remember the fallback briefly too, so an outage is not retried per call.
        const stroops = cached?.stroops ?? BASE_FEE_STROOPS;
        feeCache.set(network, { stroops, fetchedAt: Date.now() });
        return stroops;
      })
      .finally(() => feeInFlight.delete(network));
    feeInFlight.set(network, pending);
  }
  return pending;
}

/**
 * Convert a fee in stroops (default: the network minimum) to XLM.
 * For the live network fee use getFeeEstimate.
 */
export function calculateFeeEstimate(
  feeStroops: number = BASE_FEE_STROOPS
): number {
  return feeStroops / STROOPS_PER_XLM;
}

/** The current recommended fee for a one-operation transaction, in XLM. */
export async function getFeeEstimate(
  network: "testnet" | "mainnet" = getCurrentNetwork()
): Promise<number> {
  return calculateFeeEstimate(await getRecommendedFeeStroops(network));
}

/**
 * Get the current XLM price in USD
 */
export async function getXLMPrice(): Promise<number> {
  const startTime = Date.now();

  try {
    logger.debug("Fetching XLM price", {
      operation: "getXLMPrice",
    });

    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd"
    );
    const data = await response.json();

    const durationMs = Date.now() - startTime;
    logger.debug("XLM price fetched", {
      operation: "getXLMPrice",
      price: data.stellar.usd,
      durationMs,
    });

    return data.stellar.usd;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error("Failed to fetch XLM price", {
      operation: "getXLMPrice",
      durationMs,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return 0.12; // Fallback price
  }
}

/**
 * Check if the account has insufficient balance for the payment and fee
 */
export async function hasInsufficientBalance(
  publicKey: string,
  amount: string,
  feeStroops?: number
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
    const fee = calculateFeeEstimate(
      feeStroops ?? (await getRecommendedFeeStroops(network))
    );
    const required = parseFloat(amount) + fee;
    return balance < required;
  } catch (error) {
    // If account doesn't exist, it definitely has insufficient balance
    console.error("Failed to check balance:", error);
    return true;
  }
}
