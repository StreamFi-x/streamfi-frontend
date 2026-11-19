"use client";

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import type { NotificationPreferences } from "@/lib/notifications/preferences";

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  loading?: boolean;
}

interface NotificationOptionType {
  key: keyof NotificationPreferences;
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
  onOptionToggle: (key: keyof NotificationPreferences, enabled: boolean) => void;
  loading?: boolean;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ enabled, onChange, loading }) => {
  return (
    <div
      className={`flex-shrink-0 w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${
        enabled ? "bg-highlight" : "bg-muted"
      } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
      onClick={() => !loading && onChange(!enabled)}
    >
      <div
        className={`bg-white w-4 h-4 rounded-full transform transition-transform ${
          enabled ? "translate-x-6" : "translate-x-0"
        }`}
      />
    </div>
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
      <div
        className="flex justify-between items-center cursor-pointer p-6"
        onClick={toggleSection}
      >
        <div className="flex-1">
          <h2 className="text-highlight text-xl font-medium">{title}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        <button className="text-foreground">
          {isOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
        </button>
      </div>

      {isOpen && (
        <div>
          <hr className="border-border m-0 w-[96%] mx-auto" />
          <div>
            {options.map((option) => (
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
                  onChange={(enabled) => onOptionToggle(option.key, enabled)}
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
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    inApp: false,
    email: false,
  });

  // Fetch preferences on mount
  useEffect(() => {
    if (!authenticated || !user) {
      setLoading(false);
      return;
    }

    const fetchPreferences = async () => {
      try {
        const res = await fetch("/api/routes-f/notification-preferences", {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error("Failed to fetch preferences");
        }
        const data = await res.json();
        setPreferences(data);
        setError(null);
      } catch (err) {
        console.error("[NotificationSettings] fetch error:", err);
        setError("Failed to load notification preferences");
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, [authenticated, user]);

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleOptionToggle = useCallback(
    async (key: keyof NotificationPreferences, enabled: boolean) => {
      if (!preferences) return;

      // Optimistic update
      setPreferences((prev) => prev ? { ...prev, [key]: enabled } : null);

      // Save to server
      setSaving(true);
      try {
        const res = await fetch("/api/routes-f/notification-preferences", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [key]: enabled }),
        });

        if (!res.ok) {
          throw new Error("Failed to save preferences");
        }

        const updated = await res.json();
        setPreferences(updated);
        setError(null);
      } catch (err) {
        console.error("[handleOptionToggle] error:", err);
        // Revert optimistic update
        setPreferences((prev) => prev ? { ...prev, [key]: !enabled } : null);
        setError("Failed to save preference. Please try again.");
      } finally {
        setSaving(false);
      }
    },
    [preferences]
  );

  if (!authenticated) {
    return (
      <div className="bg-secondary text-foreground min-h-screen p-6">
        <div className="max-w-2xl mx-auto">
          <p className="text-muted-foreground">Please log in to manage notification preferences.</p>
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
          <p className="text-red-500">Failed to load notification preferences.</p>
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
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm">
            {error}
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Notification Preferences</h1>
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
              try {
                const res = await fetch("/api/routes-f/notification-preferences", {
                  method: "PUT",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ unsubscribed_all: !preferences.unsubscribed_all }),
                });
                if (res.ok) {
                  const updated = await res.json();
                  setPreferences(updated);
                }
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
