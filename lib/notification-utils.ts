import { formatDistanceToNowStrict } from "date-fns";
import type { Notification } from "@/types/notifications";

export function getNotificationHref(notification: Notification) {
  return notification.metadata?.url || "/dashboard/notifications";
}

export function formatNotificationRelativeTime(createdAt: string) {
  try {
    return formatDistanceToNowStrict(new Date(createdAt), {
      addSuffix: true,
    });
  } catch {
    return "just now";
  }
}
