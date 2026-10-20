"use client";

import { useState } from "react";

interface ChatModeSettingsProps {
  wallet: string;
  slowModeSeconds: number;
  subscriberOnly: boolean;
  onUpdate: (patch: { chatSlowModeSeconds?: number; chatSubscriberOnly?: boolean }) => void;
}

export default function ChatModeSettings({
  wallet,
  slowModeSeconds,
  subscriberOnly,
  onUpdate,
}: ChatModeSettingsProps) {
  const [slowModeSecs, setSlowModeSecs] = useState(String(slowModeSeconds));
  const [subOnly, setSubOnly] = useState(subscriberOnly);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = async () => {
    const parsed = parseInt(slowModeSecs, 10);
    if (isNaN(parsed) || parsed < 0 || parsed > 300) {
      setMessage('Slow mode interval must be between 0 and 300 seconds.');
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/streams/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          chatSlowModeSeconds: parsed,
          chatSubscriberOnly: subOnly,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || 'Failed to update chat mode settings.');
        return;
      }

      onUpdate({ chatSlowModeSeconds: parsed, chatSubscriberOnly: subOnly });
      setMessage('Chat mode settings saved.');
    } catch {
      setMessage('Failed to update chat mode settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Chat Modes</h3>
          <p className="text-xs text-muted-foreground">
            Control the pace and access of your stream chat.
          </p>
        </div>
      </div>

      {/* Slow mode */}
      <div className="mb-3">
        <label className="text-xs font-medium text-foreground block mb-1">
          Slow Mode (seconds between messages, 0 = off)
        </label>
        <input
          type="number"
          min={0}
          max={300}
          value={slowModeSecs}
          onChange={e => setSlowModeSecs(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="0"
        />
      </div>

      {/* Subscriber-only */}
      <div className="flex items-center gap-2 mb-3">
        <label className="inline-flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={subOnly}
            onChange={e => setSubOnly(e.target.checked)}
          />
          Subscriber-only chat
        </label>
        <p className="text-xs text-muted-foreground">
          Only active subscribers can send messages.
        </p>
      </div>

      {message && (
        <p className="text-xs text-muted-foreground mb-3">{message}</p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className="rounded-lg bg-highlight px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {isSaving ? 'Saving...' : 'Save chat settings'}
      </button>
    </div>
  );
}
