"use client";
import { ToastProvider } from "@/components/ui/toast-provider";
import NotificationSettings from "@/components/settings/notifications/notification-settings";

export default function NotificationSettingsPage() {
  return (
    <ToastProvider>
      <NotificationSettings />
    </ToastProvider>
  );
}
