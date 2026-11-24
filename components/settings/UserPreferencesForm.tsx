"use client";

import { useState } from "react";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n/languages";
import { toast } from "sonner";

/**
 * Cross-device user preferences form.
 * Covers stream quality, notifications, UI theme, language, and chat settings.
 */
export function UserPreferencesForm() {
  const { preferences, isLoading, update } = useUserPreferences();
  const {
    preferences: notificationPreferences,
    isLoading: isNotificationLoading,
    error: notificationLoadError,
    update: updateNotificationPreferences,
  } = useNotificationPreferences();
  const [isSavingNotification, setIsSavingNotification] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(
    null
  );

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">Loading preferences…</div>
    );
  }
  if (!preferences) {
    return (
      <div className="text-sm text-muted-foreground">
        Could not load preferences.
      </div>
    );
  }

  const handleChange = async (patch: Parameters<typeof update>[0]) => {
    try {
      await update(patch);
      toast.success("Preference saved");
    } catch {
      toast.error("Failed to save preference");
    }
  };

  const handleNotificationChange = async (
    key: "notify_live" | "notify_clip_created" | "notify_tip_received",
    enabled: boolean
  ) => {
    setIsSavingNotification(true);
    setNotificationError(null);
    try {
      await updateNotificationPreferences({ [key]: enabled });
      toast.success("Notification preference saved");
    } catch (error) {
      console.error("[UserPreferencesForm] notification save error:", error);
      setNotificationError(
        "Failed to save notification preference. Please try again."
      );
      toast.error("Failed to save notification preference");
    } finally {
      setIsSavingNotification(false);
    }
  };

  return (
    <div className="space-y-8 text-foreground">
      {/* Playback */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Playback
        </h3>
        <div className="flex items-center justify-between">
          <label htmlFor="stream_quality" className="text-sm">
            Default stream quality
          </label>
          <select
            id="stream_quality"
            value={preferences.stream_quality}
            onChange={e =>
              handleChange({
                stream_quality: e.target
                  .value as typeof preferences.stream_quality,
              })
            }
            className="bg-muted text-foreground text-sm px-3 py-1.5 rounded-lg border border-border focus:outline-none"
          >
            {(["auto", "1080p", "720p", "480p", "360p"] as const).map(q => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Notifications */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Notifications
        </h3>
        {(
          [
            {
              key: "notify_live",
              label: "Notify when a followed streamer goes live",
            },
            {
              key: "notify_clip_created",
              label: "Notify when someone clips your stream",
            },
            {
              key: "notify_tip_received",
              label: "Notify when you receive a tip",
            },
          ] as const
        ).map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between">
            <label htmlFor={key} className="text-sm">
              {label}
            </label>
            <input
              id={key}
              type="checkbox"
              checked={notificationPreferences?.[key] ?? false}
              disabled={
                isNotificationLoading ||
                isSavingNotification ||
                !notificationPreferences
              }
              onChange={e => handleNotificationChange(key, e.target.checked)}
              className="w-4 h-4 accent-highlight"
            />
          </div>
        ))}
        {(notificationLoadError || notificationError) && (
          <p role="alert" className="text-sm text-red-500">
            {notificationError ?? "Could not load notification preferences."}
          </p>
        )}
      </section>

      {/* Appearance */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Appearance
        </h3>
        <div className="flex items-center justify-between">
          <label htmlFor="theme" className="text-sm">
            Theme
          </label>
          <select
            id="theme"
            value={preferences.theme}
            onChange={e =>
              handleChange({
                theme: e.target.value as typeof preferences.theme,
              })
            }
            className="bg-muted text-foreground text-sm px-3 py-1.5 rounded-lg border border-border focus:outline-none"
          >
            {(["dark", "light", "system"] as const).map(t => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between">
          <label htmlFor="language" className="text-sm">
            Language
          </label>
          <select
            id="language"
            value={preferences.language}
            onChange={e => handleChange({ language: e.target.value })}
            className="bg-muted text-foreground text-sm px-3 py-1.5 rounded-lg border border-border focus:outline-none"
          >
            {SUPPORTED_LANGUAGES.map(({ code, name }) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Chat */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Chat
        </h3>
        <div className="flex items-center justify-between">
          <label htmlFor="chat_font_size" className="text-sm">
            Font size
          </label>
          <select
            id="chat_font_size"
            value={preferences.chat_font_size}
            onChange={e =>
              handleChange({
                chat_font_size: e.target
                  .value as typeof preferences.chat_font_size,
              })
            }
            className="bg-muted text-foreground text-sm px-3 py-1.5 rounded-lg border border-border focus:outline-none"
          >
            {(["small", "medium", "large"] as const).map(s => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between">
          <label htmlFor="show_timestamps" className="text-sm">
            Show message timestamps
          </label>
          <input
            id="show_timestamps"
            type="checkbox"
            checked={preferences.show_timestamps}
            onChange={e => handleChange({ show_timestamps: e.target.checked })}
            className="w-4 h-4 accent-highlight"
          />
        </div>
      </section>
    </div>
  );
}
