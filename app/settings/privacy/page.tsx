"use client";
import { ToastProvider } from "@/components/ui/toast-provider";
import PrivacySettings from "@/components/settings/privacy-and-security/PrivacyAndSecurity";

export default function PrivacySettingsPage() {
  return (
    <ToastProvider>
      <PrivacySettings />
    </ToastProvider>
  );
}
