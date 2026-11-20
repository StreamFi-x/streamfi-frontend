"use client";

import { ToastProvider } from "@/components/ui/toast-provider";
import AccountDataSection from "@/components/settings/account-data/AccountDataSection";

export default function AccountSettingsPage() {
  return (
    <ToastProvider>
      <AccountDataSection />
    </ToastProvider>
  );
}
