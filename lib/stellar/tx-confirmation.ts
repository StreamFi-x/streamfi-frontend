import { Horizon } from "@stellar/stellar-sdk";
import { getHorizonUrl, type StellarNetwork } from "./config";
import { logger } from "@/lib/tracing/logger";

export type TransactionConfirmationStatus =
  "submitted" | "polling" | "confirmed" | "failed" | "timeout";

export interface TransactionConfirmationProgress {
  status: TransactionConfirmationStatus;
  txHash: string;
  attempt: number;
  maxAttempts: number;
  elapsedMs: number;
  ledger?: number;
  error?: string;
}

export interface PollTransactionOptions {
  txHash: string;
  network: StellarNetwork;
  /** Delay between Horizon polls in milliseconds. Defaults to 2000ms. */
  pollIntervalMs?: number;
  /** Maximum number of Horizon poll attempts before timing out. Defaults to 30 (~60s). */
  maxAttempts?: number;
  /** Optional AbortSignal to stop polling (e.g. on component unmount). */
  signal?: AbortSignal;
  /** Callback invoked on every status transition and polling attempt. */
  onProgress?: (progress: TransactionConfirmationProgress) => void;
}

export interface PollTransactionResult {
  confirmed: boolean;
  status: "confirmed" | "failed" | "timeout";
  txHash: string;
  ledger?: number;
  error?: string;
  attempts: number;
  elapsedMs: number;
}

const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_MAX_ATTEMPTS = 30;

function isHorizonNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const err = error as {
    response?: { status?: number };
    name?: string;
    message?: string;
  };
  return (
    err.response?.status === 404 ||
    err.name === "NotFoundError" ||
    (typeof err.message === "string" && err.message.includes("404"))
  );
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Polling aborted"));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("Polling aborted"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Polls Stellar Horizon for a submitted transaction until it is confirmed on a
 * ledger, fails on-chain, or exhausts `maxAttempts`.
 */
export async function pollTransactionConfirmation(
  options: PollTransactionOptions
): Promise<PollTransactionResult> {
  const {
    txHash,
    network,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    signal,
    onProgress,
  } = options;

  const startedAt = Date.now();
  const server = new Horizon.Server(getHorizonUrl(network));

  onProgress?.({
    status: "submitted",
    txHash,
    attempt: 0,
    maxAttempts,
    elapsedMs: 0,
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new Error("Polling aborted");
    }

    const elapsedMs = Date.now() - startedAt;
    onProgress?.({
      status: "polling",
      txHash,
      attempt,
      maxAttempts,
      elapsedMs,
    });

    try {
      const txRecord = (await server
        .transactions()
        .transaction(txHash)
        .call()) as {
        successful?: boolean;
        ledger_attr?: number;
        ledger?: number;
      };

      const ledger = txRecord.ledger_attr ?? txRecord.ledger;
      const nowElapsed = Date.now() - startedAt;

      if (txRecord.successful === true) {
        logger.info("Stellar transaction confirmed on-chain", {
          operation: "pollTransactionConfirmation",
          txHash: txHash.slice(0, 16),
          network,
          ledger,
          attempts: attempt,
          elapsedMs: nowElapsed,
        });

        onProgress?.({
          status: "confirmed",
          txHash,
          attempt,
          maxAttempts,
          elapsedMs: nowElapsed,
          ledger,
        });

        return {
          confirmed: true,
          status: "confirmed",
          txHash,
          ledger,
          attempts: attempt,
          elapsedMs: nowElapsed,
        };
      }

      if (txRecord.successful === false) {
        const failError =
          "Transaction was rejected on the Stellar network. No funds were transferred.";
        logger.warn("Stellar transaction failed on-chain", {
          operation: "pollTransactionConfirmation",
          txHash: txHash.slice(0, 16),
          network,
          ledger,
          attempts: attempt,
          elapsedMs: nowElapsed,
        });

        onProgress?.({
          status: "failed",
          txHash,
          attempt,
          maxAttempts,
          elapsedMs: nowElapsed,
          ledger,
          error: failError,
        });

        return {
          confirmed: false,
          status: "failed",
          txHash,
          ledger,
          error: failError,
          attempts: attempt,
          elapsedMs: nowElapsed,
        };
      }
    } catch (error) {
      if (signal?.aborted) {
        throw new Error("Polling aborted");
      }

      if (!isHorizonNotFoundError(error)) {
        logger.warn("Transient Horizon error while polling transaction", {
          operation: "pollTransactionConfirmation",
          txHash: txHash.slice(0, 16),
          network,
          attempt,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (attempt < maxAttempts) {
      await sleep(pollIntervalMs, signal);
    }
  }

  const totalElapsedMs = Date.now() - startedAt;
  const timeoutError =
    "Transaction confirmation timed out on the Stellar network. It may still confirm shortly — check Stellar Explorer for the latest status.";

  logger.warn("Stellar transaction confirmation polling timed out", {
    operation: "pollTransactionConfirmation",
    txHash: txHash.slice(0, 16),
    network,
    attempts: maxAttempts,
    elapsedMs: totalElapsedMs,
  });

  onProgress?.({
    status: "timeout",
    txHash,
    attempt: maxAttempts,
    maxAttempts,
    elapsedMs: totalElapsedMs,
    error: timeoutError,
  });

  return {
    confirmed: false,
    status: "timeout",
    txHash,
    error: timeoutError,
    attempts: maxAttempts,
    elapsedMs: totalElapsedMs,
  };
}
