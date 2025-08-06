"use client";
import { ToastProvider } from "@/components/ui/toast-provider";
import PrivacySettings from "@/components/settings/privacy-and-security/privacy-and-security";

export default function PrivacySettingsPage() {
  return (
    <ToastProvider>
      <PrivacySettings />
    </ToastProvider>
  );
}
