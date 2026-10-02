"use client";

import { useEffect, useState } from "react";

export type ProtectedAction = "wallet_export" | "wallet_regeneration" | "admin_user_ban" | "admin_user_delete";

export default function StepUpDialog({
  action,
  resourceId,
  onCancel,
  onApproved,
}: {
  action: ProtectedAction | null;
  resourceId: string;
  onCancel: () => void;
  onApproved: (challengeId: string, action: ProtectedAction) => void;
}) {
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!action) {setChallengeId(""); setCode(""); setError(""); return;}
    fetch("/api/auth/step-up/challenge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, resourceId }),
    }).then(async response => {
      const data = await response.json();
      if (!response.ok) {throw new Error(data.error ?? "Unable to start verification");}
      setChallengeId(data.challengeId);
    }).catch(cause => setError(cause instanceof Error ? cause.message : "Unable to start verification"));
  }, [action, resourceId]);

  if (!action) {return null;}

  async function confirm() {
    if (!challengeId || !code || !action) {return;}
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/step-up/confirm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code }),
      });
      const data = await response.json();
      if (!response.ok) {throw new Error(data.error ?? "Code not accepted");}
      onApproved(challengeId, action);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Code not accepted");
    } finally {setBusy(false);}
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="step-up-heading">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <h2 id="step-up-heading" className="text-lg font-semibold">Verify it&apos;s you</h2>
        <p className="mt-2 text-sm text-muted-foreground">Enter an authenticator or unused recovery code to approve this action.</p>
        <input autoFocus autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} aria-label="Two-factor code" className="mt-4 w-full rounded border border-border bg-background px-3 py-2" />
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded border border-border px-3 py-2 text-sm">Cancel</button>
          <button type="button" onClick={() => void confirm()} disabled={busy || !challengeId || !code} className="rounded bg-highlight px-3 py-2 text-sm text-white disabled:opacity-50">{busy ? "Verifying…" : "Confirm"}</button>
        </div>
      </div>
    </div>
  );
}