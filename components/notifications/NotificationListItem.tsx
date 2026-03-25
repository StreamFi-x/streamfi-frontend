"use client";

import { Bell, Coins, Radio, Trash2, UserPlus, Video } from "lucide-react";
import type { Notification } from "@/types/notifications";
import { formatNotificationRelativeTime } from "@/lib/notification-utils";

interface NotificationListItemProps {
  notification: Notification;
  compact?: boolean;
  onSelect: (notification: Notification) => void;
  onDelete?: (notification: Notification) => void;
}

function NotificationTypeIcon({ type }: { type: Notification["type"] }) {
  switch (type) {
    case "new_follower":
      return <UserPlus size={16} className="text-highlight" />;
    case "tip_received":
      return <Coins size={16} className="text-emerald-500" />;
    case "stream_live":
      return <Radio size={16} className="text-red-500" />;
    case "recording_ready":
      return <Video size={16} className="text-sky-500" />;
    default:
      return <Bell size={16} className="text-muted-foreground" />;
  }
}

export default function NotificationListItem({
  notification,
  compact = false,
  onSelect,
  onDelete,
}: NotificationListItemProps) {
  return (
    <div
      className={`group flex items-start gap-3 rounded-2xl border px-4 py-3 transition-colors ${
        notification.read
          ? "border-border bg-card hover:bg-muted/40"
          : "border-highlight/30 bg-highlight/5 hover:bg-highlight/10"
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(notification)}
        className="flex min-w-0 flex-1 items-start gap-3 text-left"
      >
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary">
          <NotificationTypeIcon type={notification.type} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {notification.title}
            </p>
            {!notification.read && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-highlight" />
            )}
          </div>
          {notification.body && (
            <p
              className={`mt-1 text-sm text-muted-foreground ${
                compact ? "line-clamp-1" : "line-clamp-2"
              }`}
            >
              {notification.body}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {formatNotificationRelativeTime(notification.createdAt)}
          </p>
        </div>
      </button>

      {onDelete && !compact && (
        <button
          type="button"
          onClick={() => onDelete(notification)}
          className="mt-1 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Delete notification"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}