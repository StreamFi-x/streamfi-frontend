"use client";

import { useEffect, useState } from "react";

export default function TwoFactorManager() {
  const [enabled, setEnabled] = useState(false);
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/two-factor/enroll", { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(data => {if (data) {setEnabled(data.enabled);}})
      .catch(() => {});
  }, []);

  async function beginEnrollment() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/two-factor/enroll", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {throw new Error(data.error ?? "Unable to start enrollment");}
      setSecret(data.secret);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start enrollment");
    } finally {setBusy(false);}
  }

  async function confirmEnrollment() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/two-factor/enroll", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }),
      });
      const data = await response.json();
      if (!response.ok) {throw new Error(data.error ?? "Unable to confirm code");}
      setEnabled(true); setSecret(""); setCode(""); setRecoveryCodes(data.recoveryCodes);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to confirm code");
    } finally {setBusy(false);}
  }

  async function disable() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/two-factor/enroll", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }),
      });
      const data = await response.json();
      if (!response.ok) {throw new Error(data.error ?? "Unable to disable two-factor authentication");}
      setEnabled(false); setCode("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to disable two-factor authentication");
    } finally {setBusy(false);}
  }

  return (
    <section className="mb-6 rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">Two-factor authentication</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use an authenticator code to approve wallet exports, wallet regeneration, and sensitive admin actions.</p>
        </div>
        <span className={enabled ? "text-sm font-medium text-emerald-700" : "text-sm text-muted-foreground"}>{enabled ? "Enabled" : "Not enabled"}</span>
      </div>
      {!enabled && !secret && <button type="button" onClick={() => void beginEnrollment()} disabled={busy} className="mt-4 rounded bg-highlight px-4 py-2 text-sm text-white disabled:opacity-50">Set up authenticator</button>}
      {secret && <div className="mt-4 space-y-3">
        <p className="text-sm">Add this secret to your authenticator app, then enter the six-digit code:</p>
        <code className="block break-all rounded border border-border bg-background p-3 text-sm">{secret}</code>
        <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} aria-label="Authenticator code" className="w-full max-w-xs rounded border border-border bg-background px-3 py-2" />
        <button type="button" onClick={() => void confirmEnrollment()} disabled={busy || code.length < 6} className="rounded bg-highlight px-4 py-2 text-sm text-white disabled:opacity-50">Confirm and enable</button>
      </div>}
      {enabled && <div className="mt-4 flex flex-wrap gap-2">
        <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} aria-label="Authenticator code to disable two-factor authentication" className="w-full max-w-xs rounded border border-border bg-background px-3 py-2" />
        <button type="button" onClick={() => void disable()} disabled={busy || code.length < 6} className="rounded border border-border px-4 py-2 text-sm disabled:opacity-50">Disable</button>
      </div>}
      {recoveryCodes.length > 0 && <div className="mt-4 rounded border border-amber-500/50 bg-amber-50 p-4 text-amber-950">
        <h3 className="font-semibold">Save these recovery codes now</h3>
        <p className="mt-1 text-xs">Each code works once. They will not be shown again.</p>
        <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm">{recoveryCodes.map(code => <li key={code}>{code}</li>)}</ul>
        <button type="button" onClick={() => setRecoveryCodes([])} className="mt-3 text-sm underline">I saved these codes</button>
      </div>}
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}