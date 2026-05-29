"use client";

import { useMemo, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";

type AccessType = "password" | "subscription";

interface AccessGateProps {
  playbackId: string;
  username: string;
  onAccessGranted: () => void;
  accessType: AccessType;
  monthlyPrice?: number | null;
  viewerPublicKey?: string | null;
}

export default function AccessGate({
  username,
  onAccessGranted,
  accessType,
  monthlyPrice,
  viewerPublicKey,
}: AccessGateProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const subtitle = useMemo(() => {
    if (accessType === "subscription") {
      return monthlyPrice
        ? `This stream is for supporters. A subscription of ${monthlyPrice} USDC is required.`
        : "This stream is for supporters only.";
    }

    return "This stream is password protected.";
  }, [accessType, monthlyPrice]);

  const handleSubmit = () => {
    if (accessType === "subscription") {
      setError(
        viewerPublicKey
          ? "Subscription validation is not available on this branch yet."
          : "Connect a wallet to continue when subscription validation is available."
      );
      return;
    }

    if (!password.trim()) {
      setError("Enter the stream password to continue.");
      return;
    }

    setError(null);
    onAccessGranted();
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            {accessType === "subscription" ? (
              <ShieldCheck className="w-6 h-6 text-muted-foreground" />
            ) : (
              <Lock className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {accessType === "subscription"
                ? "Supporter-only stream"
                : "Password-protected stream"}
            </h1>
            <p className="text-sm text-muted-foreground">Creator: {username}</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-5">{subtitle}</p>

        {accessType === "password" && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground mb-2">
              Stream password
            </label>
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Enter password"
            />
          </div>
        )}

        {error && <p className="text-sm text-destructive mb-4">{error}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          className="w-full rounded-lg bg-highlight px-4 py-2.5 text-sm font-medium text-primary-foreground"
        >
          {accessType === "subscription" ? "Check access" : "Unlock stream"}
        </button>
      </div>
    </div>
  );
}
