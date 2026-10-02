"use client";

import { useState } from "react";

interface StreamPasswordSettingsProps {
  wallet: string;
  isPasswordProtected: boolean;
  onUpdate: (nextValue: boolean) => void;
}

export default function StreamPasswordSettings({
  wallet,
  isPasswordProtected,
  onUpdate,
}: StreamPasswordSettingsProps) {
  const [enabled, setEnabled] = useState(isPasswordProtected);
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/streams/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          streamAccessType: enabled ? "password" : "public",
          password: enabled ? password : "",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Failed to update stream access.");
        return;
      }

      onUpdate(enabled);
      setPassword("");
      setMessage("Stream access settings updated.");
    } catch {
      setMessage("Failed to update stream access.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Password Protection
          </h3>
          <p className="text-xs text-muted-foreground">
            Require a password before viewers can enter the stream.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={enabled}
            onChange={event => setEnabled(event.target.checked)}
          />
          Enabled
        </label>
      </div>

      {enabled && (
        <input
          type="password"
          value={password}
          onChange={event => setPassword(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm mb-3"
          placeholder="Set stream password"
        />
      )}

      {message && (
        <p className="text-xs text-muted-foreground mb-3">{message}</p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving || (enabled && password.trim().length === 0)}
        className="rounded-lg bg-highlight px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {isSaving ? "Saving..." : "Save access settings"}
      </button>
    </div>
  );
}
