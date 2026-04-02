"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Bell, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import NotificationListItem from "@/components/notifications/NotificationListItem";
import { useNotifications } from "@/hooks/use-notifications";
import { getNotificationHref } from "@/lib/notification-utils";
import type { Notification } from "@/types/notifications";

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const {
    notifications,
    unreadCount,
    isLoading,
    isSessionActive,
    markAllAsRead,
    markAsRead,
  } = useNotifications({ limit: 5, stream: true });

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = async (notification: Notification) => {
    try {
      if (!notification.read) {
        await markAsRead(notification.id);
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }

    setOpen(false);
    router.push(getNotificationHref(notification));
  };

  const handleOpen = () => {
    setOpen(prev => {
      const next = !prev;
      if (next && unreadCount > 0) {
        void markAllAsRead().catch(error => {
          console.error("Failed to mark all notifications as read:", error);
        });
      }
      return next;
    });
  };

  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount);

  if (!isLoading && !isSessionActive) {
    return null;
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="relative p-1 rounded-md hover:bg-muted transition-colors"
        aria-label="Notifications"
      >
        <Bell className="text-foreground w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center leading-none">
            {badgeLabel}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold text-foreground">
                Notifications
              </span>
              <div className="flex items-center gap-2">
                {notifications.some(n => !n.read) && (
                  <button
                    onClick={() => {
                      void markAllAsRead();
                    }}
                    className="text-xs text-highlight hover:underline"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto p-3">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-20 animate-pulse rounded-2xl bg-muted/50"
                    />
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">
                  No notifications yet
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.map(notification => (
                    <NotificationListItem
                      key={notification.id}
                      notification={notification}
                      compact
                      onSelect={selected => {
                        void handleSelect(selected);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-border px-4 py-3 text-right">
              <Link
                href="/dashboard/notifications"
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-highlight hover:underline"
              >
                View all
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
