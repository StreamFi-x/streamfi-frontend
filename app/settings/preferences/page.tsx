"use client";
import { UserPreferencesForm } from "@/components/settings/UserPreferencesForm";

export default function PreferencesPage() {
  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Preferences</h2>
        <p className="text-sm text-muted-foreground mt-1">
          These settings sync across all your devices.
        </p>
      </div>
      <UserPreferencesForm />
    </div>
  );
}
