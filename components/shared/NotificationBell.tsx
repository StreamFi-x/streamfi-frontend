"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, UserPlus, Radio, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { usePrivy } from "@privy-io/react-auth";

interface Notification {
  id: string;
  type: "follow" | "live" | string;
  title: string;
  text: string;
  read: boolean;
  created_at: string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) {return "just now";}
  if (minutes < 60) {return `${minutes}m ago`;}
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {return `${hours}h ago`;}
  return `${Math.floor(hours / 24)}d ago`;
}

function NotificationIcon({ type }: { type: string }) {
  if (type === "follow") {return <UserPlus size={14} className="text-highlight" />;}
  if (type === "live") {return <Radio size={14} className="text-red-500" />;}
  return <Bell size={14} className="text-muted-foreground" />;
}

export default function NotificationBell() {
  const { authenticated } = usePrivy();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/users/notifications", { credentials: "include" });
      if (!res.ok) {return;}
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // silently ignore — bell is non-critical
    }
  }, []);

  // Only poll when authenticated — avoids noisy 401s for logged-out users
  useEffect(() => {
    if (!authenticated) {return;}
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [authenticated, fetchNotifications]);

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

  const markAllRead = useCallback(async () => {
    try {
      await fetch("/api/users/notifications", {
        method: "PATCH",
        credentials: "include",
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // silent fail
    }
  }, []);

  const handleOpen = () => {
    setOpen(prev => {
      const next = !prev;
      if (next && unreadCount > 0) {
        void markAllRead();
      }
      return next;
    });
  };

  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount);

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
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold text-foreground">Notifications</span>
              <div className="flex items-center gap-2">
                {notifications.some(n => !n.read) && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-highlight hover:underline"
                  >
                    Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-border">
              {notifications.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">
                  No notifications yet
                </div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    className={`flex gap-3 px-4 py-3 hover:bg-muted/50 transition-colors ${
                      n.read === false ? "border-l-2 border-highlight" : "border-l-2 border-transparent"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      <NotificationIcon type={n.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{n.text}</p>
                    </div>
                    {n.created_at && (
                      <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                        {relativeTime(n.created_at)}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
