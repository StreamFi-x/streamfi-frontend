"use client"
import { ToastProvider } from "@/components/ui/toast-provider"
import NotificationSettings from "@/components/settings/notifications/NotificationSettings"

export default function NotificationSettingsPage() {
  return (
    <ToastProvider>
      <NotificationSettings />
    </ToastProvider>
  )
}
