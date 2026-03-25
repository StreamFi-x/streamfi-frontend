"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Notification } from "@/types/notifications";

interface UseNotificationsOptions {
  limit: number;
  stream?: boolean;
}

function upsertNotification(
  current: Notification[],
  incoming: Notification,
  limit: number
) {
  const next = [incoming, ...current.filter(item => item.id !== incoming.id)];
  next.sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
  return next.slice(0, limit);
}

export function useNotifications({
  limit,
  stream = false,
}: UseNotificationsOptions) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/users/notifications?limit=${limit}`, {
        credentials: "include",
      });

      if (response.status === 401) {
        setIsSessionActive(false);
        setNotifications([]);
        setUnreadCount(0);
        return false;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch notifications");
      }

      const data = await response.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
      setIsSessionActive(true);
      return true;
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  const markAllAsRead = useCallback(async () => {
    const response = await fetch("/api/users/notifications/read-all", {
      method: "PATCH",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to mark notifications as read");
    }

    setNotifications(current =>
      current.map(notification => ({ ...notification, read: true }))
    );
    setUnreadCount(0);
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    const response = await fetch(`/api/users/notifications/${notificationId}`, {
      method: "PATCH",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to update notification");
    }

    setNotifications(current =>
      current.map(notification =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      )
    );
    setUnreadCount(current => Math.max(0, current - 1));
  }, []);

  const removeNotification = useCallback(async (notificationId: string) => {
    const response = await fetch(`/api/users/notifications/${notificationId}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to delete notification");
    }

    setNotifications(current => {
      const removed = current.find(
        notification => notification.id === notificationId
      );
      if (removed && !removed.read) {
        setUnreadCount(count => Math.max(0, count - 1));
      }

      return current.filter(notification => notification.id !== notificationId);
    });
  }, []);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!stream || !isSessionActive) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      return;
    }

    const eventSource = new EventSource("/api/users/notifications/stream");
    eventSourceRef.current = eventSource;

    eventSource.onmessage = event => {
      try {
        const notification = JSON.parse(event.data) as Notification;
        let wasUnread = false;

        setNotifications(current => {
          const existing = current.find(item => item.id === notification.id);
          wasUnread = Boolean(existing && !existing.read);
          return upsertNotification(current, notification, limit);
        });

        if (!wasUnread) {
          setUnreadCount(current => current + 1);
        }
      } catch (error) {
        console.error("Failed to parse notification event:", error);
      }
    };

    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        eventSource.close();
      }
    };

    return () => {
      eventSource.close();
      if (eventSourceRef.current === eventSource) {
        eventSourceRef.current = null;
      }
    };
  }, [isSessionActive, limit, stream]);

  return {
    notifications,
    unreadCount,
    isLoading,
    isSessionActive,
    refresh: fetchNotifications,
    markAllAsRead,
    markAsRead,
    removeNotification,
  };
}