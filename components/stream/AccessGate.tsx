"use client";

import { Shield, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";

interface AccessGateProps {
  /** Streamer's username, shown in the "contact" message */
  streamerUsername: string;
  /** The Stellar asset code required (e.g. "STREAM") */
  assetCode: string;
  /** Minimum balance required, shown in the UI */
  minBalance: string;
  /** Called when the viewer connects a wallet and wants to retry the check */
  onRetry?: () => void;
  /** Whether the parent is re-checking access after wallet connect */
  isChecking?: boolean;
}

/**
 * AccessGate — shown in place of the stream player when a token_gated stream
 * denies access.
 *
 * Handles two sub-states:
 *  1. Viewer has no wallet connected → show connect prompt
 *  2. Viewer's wallet doesn't hold enough tokens → show "contact streamer" message
 */
export function AccessGate({
  streamerUsername,
  assetCode,
  minBalance,
  onRetry,
  isChecking = false,
}: AccessGateProps) {
  const { isConnected, connect } = useStellarWallet();

  const handleConnect = async () => {
    await connect();
    // After wallet connects, parent should re-check access automatically
    onRetry?.();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-6 py-12 bg-card border border-border rounded-2xl">
      <div className="p-4 rounded-full bg-highlight/10 mb-6">
        <Shield className="w-12 h-12 text-highlight" />
      </div>

      <h2 className="text-xl font-bold text-foreground mb-2">
        Token-gated stream
      </h2>

      <p className="text-muted-foreground mb-1">
        You need to hold at least{" "}
        <span className="font-semibold text-foreground">
          {minBalance} {assetCode}
        </span>{" "}
        to watch this stream.
      </p>

      <p className="text-muted-foreground text-sm mb-8">
        Contact{" "}
        <span className="font-semibold text-foreground">
          @{streamerUsername}
        </span>{" "}
        to find out how to get {assetCode} tokens.
      </p>

      {isChecking ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Checking access…
        </div>
      ) : !isConnected ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground">
            Connect your Stellar wallet to verify token ownership.
          </p>
          <Button
            onClick={handleConnect}
            className="bg-highlight hover:bg-highlight/90 text-white"
          >
            Connect Wallet
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <Button
            variant="outline"
            onClick={onRetry}
            disabled={isChecking}
          >
            Re-check access
          </Button>
          <a
            href="https://stellar.expert/explorer/public"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground underline hover:text-foreground transition-colors"
          >
            View assets on Stellar Expert
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}
