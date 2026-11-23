"use client";

import type React from "react";
import { useState, useCallback } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import type { NotificationPreferenceKey } from "@/lib/notifications/preferences";

interface ToggleSwitchProps {
  enabled: boolean;
  label: string;
  onChange: (enabled: boolean) => void;
  loading?: boolean;
}

interface NotificationOptionType {
  key: NotificationPreferenceKey;
  title: string;
  description: string;
  enabled: boolean;
}

interface NotificationCategoryProps {
  title: string;
  description: string;
  isOpen: boolean;
  toggleSection: () => void;
  options: NotificationOptionType[];
  onOptionToggle: (key: NotificationPreferenceKey, enabled: boolean) => void;
  loading?: boolean;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  enabled,
  label,
  onChange,
  loading,
}) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      disabled={loading}
      className={`flex-shrink-0 w-12 h-6 rounded-full p-1 transition-colors ${
        enabled ? "bg-highlight" : "bg-muted"
      } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
      onClick={() => onChange(!enabled)}
    >
      <span
        className={`bg-white w-4 h-4 rounded-full transform transition-transform ${
          enabled ? "translate-x-6" : "translate-x-0"
        }`}
      />
    </button>
  );
};

const NotificationCategory: React.FC<NotificationCategoryProps> = ({
  title,
  description,
  isOpen,
  toggleSection,
  options,
  onOptionToggle,
  loading,
}) => {
  return (
    <div className="bg-card border border-border shadow-sm rounded-lg mb-4 overflow-hidden">
      <button
        type="button"
        aria-expanded={isOpen}
        className="flex justify-between items-center text-left w-full p-6"
        onClick={toggleSection}
      >
        <span className="flex-1">
          <span className="block text-highlight text-xl font-medium">
            {title}
          </span>
          <span className="block text-muted-foreground text-sm">
            {description}
          </span>
        </span>
        <span className="text-foreground">
          {isOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
        </span>
      </button>

      {isOpen && (
        <div>
          <hr className="border-border m-0 w-[96%] mx-auto" />
          <div>
            {options.map(option => (
              <div
                key={option.key}
                className="py-5 flex justify-between items-center px-6 pl-24 md:pl-20"
              >
                <div className="flex-1 pr-4">
                  <h3 className="text-foreground">{option.title}</h3>
                  <p className="text-muted-foreground text-sm italic font-light">
                    {option.description}
                  </p>
                </div>
                <ToggleSwitch
                  enabled={option.enabled}
                  label={option.title}
                  onChange={enabled => onOptionToggle(option.key, enabled)}
                  loading={loading}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const NotificationSettings: React.FC = () => {
  const { user, authenticated } = usePrivy();
  const {
    preferences,
    isLoading: loading,
    error: loadError,
    update,
  } = useNotificationPreferences(authenticated && !!user);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    inApp: false,
    email: false,
  });

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleOptionToggle = useCallback(
    async (key: NotificationPreferenceKey, enabled: boolean) => {
      if (!preferences || saving) return;
      setSaving(true);
      setError(null);
      try {
        await update({ [key]: enabled });
      } catch (err) {
        console.error("[handleOptionToggle] error:", err);
        setError("Failed to save preference. Please try again.");
      } finally {
        setSaving(false);
      }
    },
    [preferences, saving, update]
  );

  if (!authenticated) {
    return (
      <div className="bg-secondary text-foreground min-h-screen p-6">
        <div className="max-w-2xl mx-auto">
          <p className="text-muted-foreground">
            Please log in to manage notification preferences.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-secondary text-foreground min-h-screen p-6">
        <div className="max-w-2xl mx-auto">
          <p className="text-muted-foreground">Loading preferences...</p>
        </div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="bg-secondary text-foreground min-h-screen p-6">
        <div className="max-w-2xl mx-auto">
          <p className="text-red-500" role="alert">
            {loadError
              ? "Failed to load notification preferences."
              : "Notification preferences are unavailable."}
          </p>
        </div>
      </div>
    );
  }

  const inAppOptions: NotificationOptionType[] = [
    {
      key: "notify_follow",
      title: "New Followers",
      description: "When someone follows your channel",
      enabled: preferences.notify_follow,
    },
    {
      key: "notify_live",
      title: "Go Live Alerts",
      description: "When creators you follow go live",
      enabled: preferences.notify_live,
    },
    {
      key: "notify_tip_received",
      title: "Tips Received",
      description: "When viewers tip you during a stream",
      enabled: preferences.notify_tip_received,
    },
    {
      key: "notify_new_subscriber",
      title: "New Subscribers",
      description: "When someone subscribes to your channel",
      enabled: preferences.notify_new_subscriber,
    },
    {
      key: "notify_clip_featured",
      title: "Featured Clips",
      description: "When your clips are featured",
      enabled: preferences.notify_clip_featured,
    },
    {
      key: "notify_clip_created",
      title: "Clips Created",
      description: "When someone clips your stream",
      enabled: preferences.notify_clip_created,
    },
    {
      key: "notify_payment_confirmed",
      title: "Payment Confirmations",
      description: "When your payouts are confirmed",
      enabled: preferences.notify_payment_confirmed,
    },
    {
      key: "notify_system",
      title: "System Updates",
      description: "Platform announcements and important updates",
      enabled: preferences.notify_system,
    },
  ];

  const emailOptions: NotificationOptionType[] = [
    {
      key: "email_notify_follow",
      title: "New Followers",
      description: "Email when someone follows your channel",
      enabled: preferences.email_notify_follow,
    },
    {
      key: "email_notify_tip_received",
      title: "Tips Received",
      description: "Email when viewers tip you",
      enabled: preferences.email_notify_tip_received,
    },
    {
      key: "email_notify_new_subscriber",
      title: "New Subscribers",
      description: "Email when someone subscribes",
      enabled: preferences.email_notify_new_subscriber,
    },
    {
      key: "email_notify_payment_confirmed",
      title: "Payment Confirmations",
      description: "Email when payouts are confirmed",
      enabled: preferences.email_notify_payment_confirmed,
    },
    {
      key: "email_digest",
      title: "Weekly Digest",
      description: "Receive a weekly summary of your activity",
      enabled: preferences.email_digest,
    },
  ];

  return (
    <div className="bg-secondary text-foreground min-h-screen p-6">
      <div className="max-w-2xl mx-auto">
        {error && (
          <div
            role="alert"
            className="mb-4 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm"
          >
            {error}
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Notification Preferences
          </h1>
          <p className="text-muted-foreground">
            Control how and when you receive notifications from StreamFi
          </p>
        </div>

        <NotificationCategory
          title="In-app Notifications"
          description="Notifications that appear within StreamFi"
          isOpen={openSections.inApp}
          toggleSection={() => toggleSection("inApp")}
          options={inAppOptions}
          onOptionToggle={handleOptionToggle}
          loading={saving}
        />

        <NotificationCategory
          title="Email Notifications"
          description="Notifications sent to your email address"
          isOpen={openSections.email}
          toggleSection={() => toggleSection("email")}
          options={emailOptions}
          onOptionToggle={handleOptionToggle}
          loading={saving}
        />

        <div className="mt-8 p-4 bg-muted rounded-lg">
          <button
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                await update({
                  unsubscribed_all: !preferences.unsubscribed_all,
                });
              } catch (err) {
                console.error(
                  "[NotificationSettings] global update error:",
                  err
                );
                setError(
                  "Failed to update notification preferences. Please try again."
                );
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            className="text-red-500 hover:text-red-600 font-medium disabled:opacity-50"
          >
            {preferences.unsubscribed_all
              ? "Re-subscribe to all notifications"
              : "Unsubscribe from all notifications"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
