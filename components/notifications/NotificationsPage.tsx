"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, RefreshCcw } from "lucide-react";
import NotificationListItem from "@/components/notifications/NotificationListItem";
import { useNotifications } from "@/hooks/use-notifications";
import { getNotificationHref } from "@/lib/notification-utils";
import type { Notification } from "@/types/notifications";

export default function NotificationsPage() {
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);
  const {
    notifications,
    unreadCount,
    isLoading,
    refresh,
    markAllAsRead,
    markAsRead,
    removeNotification,
  } = useNotifications({ limit: 50, stream: true });

  const handleSelect = async (notification: Notification) => {
    setActionError(null);

    try {
      if (!notification.read) {
        await markAsRead(notification.id);
      }

      const href = getNotificationHref(notification);
      if (href !== "/dashboard/notifications") {
        router.push(href);
      }
    } catch (error) {
      console.error("Failed to open notification:", error);
      setActionError("Failed to open notification.");
    }
  };

  const handleDelete = async (notification: Notification) => {
    setActionError(null);

    try {
      await removeNotification(notification.id);
    } catch (error) {
      console.error("Failed to delete notification:", error);
      setActionError("Failed to delete notification.");
    }
  };

  const handleMarkAllRead = async () => {
    setActionError(null);

    try {
      await markAllAsRead();
    } catch (error) {
      console.error("Failed to mark notifications as read:", error);
      setActionError("Failed to mark notifications as read.");
    }
  };

  return (
    <section className="min-h-full bg-secondary px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-border bg-card px-6 py-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-highlight/10 text-highlight">
                  <Bell size={20} />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-foreground">
                    Notifications
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Latest account activity, live alerts, and recording updates.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full bg-secondary px-4 py-2 text-sm text-foreground">
                {unreadCount} unread
              </div>
              <button
                type="button"
                onClick={() => void refresh()}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <RefreshCcw size={14} />
                Refresh
              </button>
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="rounded-full bg-highlight px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Mark all as read
              </button>
            </div>
          </div>
          {actionError && (
            <p className="mt-4 text-sm text-red-500">{actionError}</p>
          )}
        </div>

        <div className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-24 animate-pulse rounded-2xl bg-muted/50"
                />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-secondary/40 px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-card text-muted-foreground">
                <Bell size={24} />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-foreground">
                Nothing new right now
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                New followers, tips, live stream alerts, and recording updates
                will show up here as they happen.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map(notification => (
                <NotificationListItem
                  key={notification.id}
                  notification={notification}
                  onSelect={notification => {
                    void handleSelect(notification);
                  }}
                  onDelete={notification => {
                    void handleDelete(notification);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
