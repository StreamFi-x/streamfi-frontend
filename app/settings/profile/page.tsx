"use client";
import { ToastProvider } from "@/components/ui/toast-provider";
import ProfileSettings from "@/components/settings/profile/profile-page";

export default function ProfileSettingsPage() {
  return (
    <ToastProvider>
      <ProfileSettings />
    </ToastProvider>
  );
}
