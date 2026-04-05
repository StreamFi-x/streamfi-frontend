"use client";

import { useState } from "react";
import {
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { StreamAccessType, TokenGateConfig } from "@/types/stream-access";

interface TokenGateSettingsProps {
  /** Current access type persisted for this user */
  currentAccessType: StreamAccessType;
  /** Current token gate config (if any) */
  currentConfig: TokenGateConfig | null;
  /** Called with the new settings when the user saves */
  onSave: (
    accessType: StreamAccessType,
    config: TokenGateConfig | null
  ) => Promise<void>;
}

type VerifyState = "idle" | "verifying" | "found" | "not_found" | "error";

/**
 * TokenGateSettings — rendered inside the stream-preference settings page.
 *
 * Lets the streamer:
 *  - Toggle between public and token_gated
 *  - Enter asset code, issuer, and min balance
 *  - Verify the asset exists on Stellar via the "Verify" button
 *  - Save the configuration
 */
export function TokenGateSettings({
  currentAccessType,
  currentConfig,
  onSave,
}: TokenGateSettingsProps) {
  const [accessType, setAccessType] =
    useState<StreamAccessType>(currentAccessType);
  const [assetCode, setAssetCode] = useState(currentConfig?.asset_code ?? "");
  const [assetIssuer, setAssetIssuer] = useState(
    currentConfig?.asset_issuer ?? ""
  );
  const [minBalance, setMinBalance] = useState(
    currentConfig?.min_balance ?? "1"
  );
  const [verifyState, setVerifyState] = useState<VerifyState>("idle");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!assetCode.trim() || !assetIssuer.trim()) {
      return;
    }
    setVerifyState("verifying");
    try {
      const res = await fetch(
        `/api/streams/access/verify-asset?code=${encodeURIComponent(assetCode.trim())}&issuer=${encodeURIComponent(assetIssuer.trim())}`
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        console.error("[verify-asset]", json.error);
        setVerifyState("error");
        return;
      }
      const { exists } = await res.json();
      setVerifyState(exists ? "found" : "not_found");
    } catch {
      setVerifyState("error");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const config: TokenGateConfig | null =
        accessType === "token_gated"
          ? {
              asset_code: assetCode.trim(),
              asset_issuer: assetIssuer.trim(),
              min_balance: minBalance.trim() || "1",
            }
          : null;
      await onSave(accessType, config);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save settings."
      );
    } finally {
      setSaving(false);
    }
  };

  const isTokenGated = accessType === "token_gated";
  const canSave =
    !saving &&
    (accessType === "public" ||
      (assetCode.trim().length > 0 && assetIssuer.trim().length > 0));

  return (
    <div className="space-y-6">
      {/* Access type selector */}
      <div>
        <h2 className="text-highlight text-xl font-medium mb-3">
          Stream Access
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => setAccessType("public")}
            className={cn(
              "flex-1 py-2.5 px-4 rounded-lg border text-sm font-medium transition-colors",
              accessType === "public"
                ? "bg-highlight text-white border-highlight"
                : "bg-input border-border text-muted-foreground hover:text-foreground"
            )}
          >
            Public
          </button>
          <button
            onClick={() => setAccessType("token_gated")}
            className={cn(
              "flex-1 py-2.5 px-4 rounded-lg border text-sm font-medium transition-colors",
              accessType === "token_gated"
                ? "bg-highlight text-white border-highlight"
                : "bg-input border-border text-muted-foreground hover:text-foreground"
            )}
          >
            Token-gated
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground italic">
          {accessType === "public"
            ? "Anyone can watch your stream."
            : "Only viewers holding your token can watch."}
        </p>
      </div>

      {/* Token gate config — shown only when token_gated */}
      {isTokenGated && (
        <div className="space-y-4 p-4 bg-muted/40 border border-border rounded-lg">
          {/* Asset Code */}
          <div className="space-y-1.5">
            <Label htmlFor="asset-code">Asset Code</Label>
            <Input
              id="asset-code"
              placeholder="e.g. STREAM"
              value={assetCode}
              onChange={e => {
                setAssetCode(e.target.value.toUpperCase().slice(0, 12));
                setVerifyState("idle");
              }}
              maxLength={12}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Max 12 alphanumeric characters
            </p>
          </div>

          {/* Asset Issuer + Verify */}
          <div className="space-y-1.5">
            <Label htmlFor="asset-issuer">Asset Issuer (Public Key)</Label>
            <div className="flex gap-2">
              <Input
                id="asset-issuer"
                placeholder="G..."
                value={assetIssuer}
                onChange={e => {
                  setAssetIssuer(e.target.value.trim());
                  setVerifyState("idle");
                }}
                className="font-mono flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleVerify}
                disabled={
                  !assetCode.trim() ||
                  !assetIssuer.trim() ||
                  verifyState === "verifying"
                }
                className="shrink-0"
              >
                {verifyState === "verifying" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Verify"
                )}
              </Button>
            </div>

            {/* Verify feedback */}
            {verifyState === "found" && (
              <p className="flex items-center gap-1.5 text-xs text-green-500">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Asset found on Stellar network
              </p>
            )}
            {verifyState === "not_found" && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <XCircle className="w-3.5 h-3.5" />
                Asset not found. Make sure it has been issued and has at least
                one trustline.
              </p>
            )}
            {verifyState === "error" && (
              <p className="flex items-center gap-1.5 text-xs text-yellow-500">
                <XCircle className="w-3.5 h-3.5" />
                Could not verify — check the values and try again.
              </p>
            )}
          </div>

          {/* Min Balance */}
          <div className="space-y-1.5">
            <Label htmlFor="min-balance">Min Balance Required</Label>
            <Input
              id="min-balance"
              type="number"
              min="0.0000001"
              step="1"
              placeholder="1"
              value={minBalance}
              onChange={e => setMinBalance(e.target.value)}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              How many {assetCode || "tokens"} a viewer must hold
            </p>
          </div>

          {/* Stellar Lab guidance */}
          <div className="flex items-start gap-2.5 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300 leading-relaxed">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-400" />
            <span>
              Don&apos;t have a token yet?{" "}
              <a
                href="https://laboratory.stellar.org/#txbuilder"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold hover:text-blue-100 inline-flex items-center gap-0.5"
              >
                Create one in Stellar Laboratory
                <ExternalLink className="w-3 h-3 inline ml-0.5" />
              </a>
              . Issue a custom asset, distribute it to your community, then
              paste the asset code and issuer address above.
            </span>
          </div>
        </div>
      )}

      {/* Save */}
      {saveError && <p className="text-xs text-destructive">{saveError}</p>}
      <Button
        onClick={handleSave}
        disabled={!canSave}
        className="bg-highlight hover:bg-highlight/90 text-white"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving…
          </>
        ) : (
          "Save Access Settings"
        )}
      </Button>
    </div>
  );
}
