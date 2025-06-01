"use client"
import { ToastProvider } from "@/components/ui/toast-provider"
import ConnectedAccountsSettings from "@/components/settings/Connected Accounts/connected-account"

export default function ConnectedAccountsSettingsPage() {
  return (
    <ToastProvider>
      <ConnectedAccountsSettings />
    </ToastProvider>
  )
}
