"use client";

import React, { useState } from "react";
import { Asset, StrKey } from "@stellar/stellar-sdk";
import { logger } from "@/lib/tracing/logger";

interface TrustlineSetupProps {
  publicKey: string;
  asset: Asset;
  network: "testnet" | "mainnet";
  onSuccess?: () => void;
  onError?: (error: string) => void;
  onClose?: () => void;
  isOpen: boolean;
}

interface TrustlineTransaction {
  transaction: string;
  publicKey: string;
  assetCode: string;
  assetIssuer: string;
  networkPassphrase: string;
  fee: string;
  network: "testnet" | "mainnet";
}

export const TrustlineSetup: React.FC<TrustlineSetupProps> = ({
  publicKey,
  asset,
  network,
  onSuccess,
  onError,
  onClose,
  isOpen,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"loading" | "confirm" | "signing" | "success">(
    "loading"
  );
  const [txData, setTxData] = useState<TrustlineTransaction | null>(null);

  // Load trustline transaction on mount
  React.useEffect(() => {
    if (!isOpen || step !== "loading") return;

    const loadTransaction = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch the unsigned trustline transaction from API
        const response = await fetch("/api/routes-f/wallet-trustline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicKey,
            assetCode: asset.code,
            assetIssuer: asset.issuer,
            network,
            memo: `Setup ${asset.code} trustline`,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `HTTP ${response.status}: Failed to build trustline transaction`
          );
        }

        const data: TrustlineTransaction = await response.json();
        setTxData(data);
        setStep("confirm");
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error("Failed to load trustline transaction", {
          publicKey: publicKey.substring(0, 8),
          asset: asset.code,
          error: errorMessage,
        });
        setError(errorMessage);
        onError?.(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    loadTransaction();
  }, [isOpen, step, publicKey, asset, network, onError]);

  const handleSignTransaction = async () => {
    if (!txData) return;

    try {
      setStep("signing");
      setIsLoading(true);

      // This would be integrated with wallet client (Privy or Stellar wallet kit)
      // For now, dispatch event that parent component handles
      const event = new CustomEvent("trustlineSignRequest", {
        detail: {
          transaction: txData.transaction,
          asset: asset.code,
          network: txData.network,
        },
      });

      window.dispatchEvent(event);
      logger.info("Trustline signing requested", {
        asset: asset.code,
        network: txData.network,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      onError?.(errorMessage);
      setStep("confirm");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccess = () => {
    setStep("success");
    onSuccess?.();
  };

  // Render nothing if modal is not open
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Set Up {asset.code} Trustline
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            You need to create a trustline to send or receive {asset.code}
          </p>
        </div>

        {/* Loading State */}
        {step === "loading" && (
          <div className="space-y-4">
            <div className="animate-pulse space-y-2">
              <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700"></div>
              <div className="h-4 w-5/6 rounded bg-gray-200 dark:bg-gray-700"></div>
            </div>
          </div>
        )}

        {/* Confirm State */}
        {step === "confirm" && txData && (
          <div className="space-y-4">
            {/* Asset Details */}
            <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  Asset
                </span>
                <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">
                  {asset.code}
                </span>
              </div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  Issuer
                </span>
                <span className="font-mono truncate text-xs text-gray-500 dark:text-gray-400">
                  {txData.assetIssuer.substring(0, 8)}...
                  {txData.assetIssuer.substring(txData.assetIssuer.length - 4)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  Fee
                </span>
                <span className="font-mono text-sm text-gray-900 dark:text-white">
                  {txData.fee} XLM
                </span>
              </div>
            </div>

            {/* Reserve Notice */}
            <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20">
              <p className="text-xs text-amber-800 dark:text-amber-100">
                ⚠️ <strong>Reserve Impact:</strong> This trustline will lock up 0.5 XLM
                of your account's minimum balance reserve. Ensure your account has
                sufficient XLM to cover this.
              </p>
            </div>

            {/* Error Display */}
            {error && (
              <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
                <p className="text-xs text-red-800 dark:text-red-100">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSignTransaction}
                disabled={isLoading}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-700"
              >
                {isLoading ? "Processing..." : "Create Trustline"}
              </button>
            </div>
          </div>
        )}

        {/* Signing State */}
        {step === "signing" && (
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-700"></div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Please approve the transaction in your wallet
            </p>
          </div>
        )}

        {/* Success State */}
        {step === "success" && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
              <svg
                className="h-6 w-6 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Trustline Created Successfully
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              You can now send and receive {asset.code}
            </p>
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 dark:bg-blue-700"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrustlineSetup;
