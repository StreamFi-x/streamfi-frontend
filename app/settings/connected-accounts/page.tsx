"use client";
import { ToastProvider } from "@/components/ui/toast-provider";
import ConnectedAccountsSettings from "@/components/settings/connected-accounts/connected-account";

export default function ConnectedAccountsSettingsPage() {
  return (
    <ToastProvider>
      <ConnectedAccountsSettings />
    </ToastProvider>
  );
}
