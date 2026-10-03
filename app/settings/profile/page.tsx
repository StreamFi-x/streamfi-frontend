"use client";
import { ToastProvider } from "@/components/ui/toast-provider";
import ProfileSettings from "@/components/settings/profile/profile-page";
import Link from "next/link";
import { MonitorCog } from "lucide-react";

export default function ProfileSettingsPage() {
  return (
    <ToastProvider>
      <div>
        <div className="mx-auto max-w-5xl px-6 pt-5">
          <Link href="/settings/sessions" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <MonitorCog size={16} aria-hidden="true" />
            Manage active sessions
          </Link>
        </div>
        <ProfileSettings />
      </div>
    </ToastProvider>
  );
}
