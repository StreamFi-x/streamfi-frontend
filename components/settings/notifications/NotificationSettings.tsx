"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Coins, Radio, UserPlus, Video } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import type { NotificationPreferences } from "@/types/notifications";

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: () => void;
}

function ToggleSwitch({ enabled, onChange }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      className={`flex-shrink-0 w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${enabled ? "bg-highlight" : "bg-muted"}`}
      onClick={onChange}
    >
      <div
        className={`bg-white w-4 h-4 rounded-full transform transition-transform ${enabled ? "translate-x-6" : "translate-x-0"}`}
      />
    </button>
  );
}

const initialPreferences: NotificationPreferences = {
  newFollower: true,
  tipReceived: true,
  streamLive: true,
  recordingReady: true,
  emailNotifications: true,
};

export default function NotificationSettings() {
  const { showToast } = useToast();
  const [preferences, setPreferences] =
    useState<NotificationPreferences>(initialPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const options = useMemo(
    () => [
      {
        key: "newFollower" as const,
        label: "New followers",
        description: "Alert me when someone starts following my channel.",
        icon: UserPlus,
      },
      {
        key: "tipReceived" as const,
        label: "Tips received",
        description: "Alert me when a viewer sends an on-chain XLM tip.",
        icon: Coins,
      },
      {
        key: "streamLive" as const,
        label: "Creators going live",
        description:
          "Get in-app alerts when creators I follow start streaming.",
        icon: Radio,
      },
      {
        key: "recordingReady" as const,
        label: "Recording ready",
        description: "Notify me when a finished stream recording is processed.",
        icon: Video,
      },
      {
        key: "emailNotifications" as const,
        label: "Email notifications",
        description:
          "Send email for tip receipts when email alerts are enabled.",
        icon: Bell,
      },
    ],
    []
  );

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const response = await fetch("/api/users/notifications/preferences", {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to load notification preferences");
        }

        const data = await response.json();
        setPreferences(data.preferences ?? initialPreferences);
      } catch (error) {
        console.error("Failed to load notification preferences:", error);
        showToast("Failed to load notification preferences", "error");
      } finally {
        setIsLoading(false);
      }
    };

    void loadPreferences();
  }, [showToast]);

  const togglePreference = (key: keyof NotificationPreferences) => {
    setPreferences(current => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const saveChanges = async () => {
    setIsSaving(true);

    try {
      const response = await fetch("/api/users/notifications/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(preferences),
      });

      if (!response.ok) {
        throw new Error("Failed to save notification preferences");
      }

      showToast("Notification settings updated", "success");
    } catch (error) {
      console.error("Failed to save notification preferences:", error);
      showToast("Failed to save notification settings", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-secondary text-foreground">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-border bg-card px-6 py-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-foreground">
            Notification Preferences
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose which alerts you receive in-app and which tip events can also
            reach your inbox.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-24 animate-pulse rounded-2xl bg-muted/50"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {options.map(option => {
                const Icon = option.icon;

                return (
                  <div
                    key={option.key}
                    className="flex items-center gap-4 rounded-2xl border border-border px-4 py-4"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-highlight">
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-sm font-semibold text-foreground">
                        {option.label}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                    <ToggleSwitch
                      enabled={preferences[option.key]}
                      onChange={() => togglePreference(option.key)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            className="rounded-full bg-highlight px-6 py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void saveChanges()}
            disabled={isLoading || isSaving}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
