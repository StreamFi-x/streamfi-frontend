"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { useSWRConfig } from "swr";
import {
  useAdminFeatureFlags,
  type AdminFeatureFlag,
} from "@/hooks/admin/useAdminFeatureFlags";

function FeatureFlagDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial?: AdminFeatureFlag;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = Boolean(initial);
  const [key, setKey] = useState(initial?.key ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [rolloutPercentage, setRolloutPercentage] = useState(
    initial?.rollout_percentage ?? 0
  );
  const [allowedUserIdsText, setAllowedUserIdsText] = useState(
    (initial?.allowed_user_ids ?? []).join(", ")
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!key.trim()) {
      setError("Flag key is required.");
      return;
    }

    setSaving(true);
    setError("");

    const allowedUserIds = allowedUserIdsText
      .split(",")
      .map(id => id.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/admin/feature-flags", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: key.trim(),
          description: description.trim() || null,
          enabled,
          rollout_percentage: Math.min(
            100,
            Math.max(0, Number(rolloutPercentage) || 0)
          ),
          allowed_user_ids: allowedUserIds,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.message ?? body.error ?? "Failed to save feature flag"
        );
      }
      onSaved();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to save feature flag"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-sidebar rounded-xl border border-border p-6 w-full max-w-md mx-4"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            {isEditing ? `Edit ${initial?.key}` : "New Feature Flag"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <label
              htmlFor="flag-key-input"
              className="block text-muted-foreground mb-1"
            >
              Key
            </label>
            <input
              id="flag-key-input"
              type="text"
              disabled={isEditing}
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="e.g. new_watch_layout"
              className="w-full bg-input text-foreground rounded-lg px-3 py-2 border border-border outline-none focus:ring-1 focus:ring-highlight disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="flag-description-input"
              className="block text-muted-foreground mb-1"
            >
              Description
            </label>
            <input
              id="flag-description-input"
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full bg-input text-foreground rounded-lg px-3 py-2 border border-border outline-none focus:ring-1 focus:ring-highlight"
            />
          </div>

          <div className="flex items-center justify-between">
            <label
              htmlFor="flag-enabled-input"
              className="text-muted-foreground"
            >
              Enabled
            </label>
            <input
              id="flag-enabled-input"
              type="checkbox"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
              className="h-4 w-4"
            />
          </div>

          <div>
            <label
              htmlFor="flag-rollout-input"
              className="block text-muted-foreground mb-1"
            >
              Rollout Percentage (0 - 100)
            </label>
            <input
              id="flag-rollout-input"
              type="number"
              min={0}
              max={100}
              value={rolloutPercentage}
              onChange={e => setRolloutPercentage(Number(e.target.value))}
              className="w-full bg-input text-foreground rounded-lg px-3 py-2 border border-border outline-none focus:ring-1 focus:ring-highlight"
            />
          </div>

          <div>
            <label
              htmlFor="flag-users-input"
              className="block text-muted-foreground mb-1"
            >
              Allowed User IDs (comma-separated UUIDs)
            </label>
            <input
              id="flag-users-input"
              type="text"
              value={allowedUserIdsText}
              onChange={e => setAllowedUserIdsText(e.target.value)}
              placeholder="uuid-1, uuid-2"
              className="w-full bg-input text-foreground rounded-lg px-3 py-2 border border-border outline-none focus:ring-1 focus:ring-highlight"
            />
          </div>

          {error && (
            <p role="alert" className="text-red-400 text-xs">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm bg-surface-hover text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-4 py-2 rounded-md text-sm bg-highlight text-background font-medium hover:bg-highlight/80 disabled:opacity-50"
          >
            {saving ? "Saving…" : isEditing ? "Save Changes" : "Create Flag"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function FeatureFlagsPanel() {
  const { data, isLoading } = useAdminFeatureFlags();
  const { mutate } = useSWRConfig();
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminFeatureFlag | null>(null);
  const [error, setError] = useState("");

  const flags = data?.flags ?? [];

  const invalidate = () => {
    mutate("/api/admin/feature-flags", undefined, { revalidate: true });
  };

  const handleToggleFlag = async (flag: AdminFeatureFlag) => {
    setError("");
    try {
      const res = await fetch("/api/admin/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: flag.key, enabled: !flag.enabled }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update feature flag");
      }
      invalidate();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to update feature flag"
      );
    }
  };

  const handleDeleteFlag = async (key: string) => {
    setError("");
    try {
      const res = await fetch(
        `/api/admin/feature-flags?key=${encodeURIComponent(key)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete feature flag");
      }
      invalidate();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to delete feature flag"
      );
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <motion.h1
          className="text-2xl font-bold text-foreground"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Feature Flags
        </motion.h1>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-highlight hover:bg-highlight/80 text-background text-sm font-medium"
        >
          <Plus size={15} /> New Flag
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-4 text-sm text-red-500">
          {error}
        </p>
      )}

      <div className="bg-sidebar rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-left">
              <th className="px-4 py-3 font-medium">Key</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">
                Description
              </th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">
                Rollout
              </th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="px-4 py-3">
                      <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="h-4 w-48 bg-muted animate-pulse rounded" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="h-4 w-12 bg-muted animate-pulse rounded" />
                    </td>
                    <td className="px-4 py-3" />
                  </tr>
                ))
              : flags.map(flag => (
                  <tr
                    key={flag.key}
                    className="border-b border-border hover:bg-surface-hover transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-foreground font-medium">
                      {flag.key}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                      {flag.description || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void handleToggleFlag(flag)}
                        aria-label={`Toggle ${flag.key}`}
                        className={`text-xs px-2.5 py-0.5 rounded-full border ${
                          flag.enabled
                            ? "bg-green-900/40 text-green-400 border-green-800/40"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {flag.enabled ? "Enabled" : "Disabled"}
                      </button>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                      {flag.rollout_percentage}%
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditTarget(flag)}
                          aria-label={`Edit ${flag.key}`}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteFlag(flag.key)}
                          aria-label={`Delete ${flag.key}`}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-red-400"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>

        {!isLoading && flags.length === 0 && (
          <div className="py-16 text-center text-muted-foreground text-sm">
            No feature flags found.
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCreate && (
          <FeatureFlagDialog
            onClose={() => setShowCreate(false)}
            onSaved={invalidate}
          />
        )}
        {editTarget && (
          <FeatureFlagDialog
            initial={editTarget}
            onClose={() => setEditTarget(null)}
            onSaved={invalidate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
