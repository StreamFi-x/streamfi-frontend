"use client";

import React, { useState } from "react";
import { ShieldAlert, CheckCircle, ArrowRight, X } from "lucide-react";

interface WalletRecoveryPromptProps {
  hasRecoveryConfigured?: boolean;
  onOpenSettings?: () => void;
}

export function WalletRecoveryPrompt({
  hasRecoveryConfigured = false,
  onOpenSettings,
}: WalletRecoveryPromptProps) {
  const [dismissed, setDismissed] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"idle" | "input" | "verify" | "success">("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hasRecoveryConfigured || dismissed) {
    return null;
  }

  const handleStart = () => {
    setStep("input");
    setError(null);
  };

  const handleSubmitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/recovery/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send code");
      setStep("verify");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/recovery/verify-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setStep("success");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-amber-950/60 border border-amber-500/40 rounded-xl p-4 text-amber-100 mb-6 relative">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-amber-400/80 hover:text-amber-200"
        aria-label="Dismiss prompt"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-semibold text-sm text-amber-200">
            Secure Your Self-Custodied Account
          </h4>
          <p className="text-xs text-amber-300/80 mt-1">
            Wallet-only accounts cannot be recovered if you lose your Stellar secret key.
            Add a backup recovery email now so you never lose access to your profile and earnings.
          </p>

          {step === "idle" && (
            <button
              onClick={handleStart}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-black font-medium text-xs rounded-lg transition-colors"
            >
              Set up recovery email <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {step === "input" && (
            <form onSubmit={handleSubmitEmail} className="mt-3 flex gap-2">
              <input
                type="email"
                required
                placeholder="backup-email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-black/50 border border-amber-500/40 px-3 py-1.5 text-xs rounded-lg text-white focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-black text-xs font-medium rounded-lg disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send code"}
              </button>
            </form>
          )}

          {step === "verify" && (
            <form onSubmit={handleVerifyCode} className="mt-3 flex gap-2">
              <input
                type="text"
                maxLength={6}
                required
                placeholder="6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="bg-black/50 border border-amber-500/40 px-3 py-1.5 text-xs rounded-lg text-white text-center tracking-widest focus:outline-none focus:border-amber-400 w-28"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Confirm & Save"}
              </button>
            </form>
          )}

          {step === "success" && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle className="w-4 h-4" /> Recovery email linked successfully!
            </div>
          )}

          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        </div>
      </div>
    </div>
  );
}
