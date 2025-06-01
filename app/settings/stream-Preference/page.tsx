"use client"
import { ToastProvider } from "@/components/ui/toast-provider"
import StreamPreferenceSettings from "@/components/settings/Stream & Channel Preferences/stream-preference"

export default function StreamPreferenceSettingsPage() {
  return (
    <ToastProvider>
      <StreamPreferenceSettings />
    </ToastProvider>
  )
}
