"use client";
import { ToastProvider } from "@/components/ui/toast-provider";
import SubscriptionTiersSettings from "@/components/settings/subscription-tiers/SubscriptionTiersSettings";

export default function SubscriptionTiersSettingsPage() {
  return (
    <ToastProvider>
      <SubscriptionTiersSettings />
    </ToastProvider>
  );
}
