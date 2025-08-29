"use client";

import type { FormState, UIState } from "@/types/settings/profile";
import { AlertTriangle } from "lucide-react";
import { Check } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface BasicSettingsSectionProps {
  formState: FormState;
  updateFormField: (field: keyof FormState, value: string) => void;
  updateUiState: (updates: Partial<UIState>) => void;
  uiState: UIState;
}

export function BasicSettingsSection({
  formState,
  updateFormField,
  updateUiState,
  uiState,
}: BasicSettingsSectionProps) {
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const getInputStyle = (inputName: string) => {
    return `w-full bg-input rounded-lg px-4 py-3 text-sm font-medium outline-none ${
      uiState.focusedInput === inputName
        ? "border border-purple-600"
        : "border border-transparent"
    } transition-all duration-200`;
  };
  useEffect(() => {
    try {
      const userData = sessionStorage.getItem("userData");
      if (userData) {
        const parsedUserData = JSON.parse(userData);
        // Check if email is verified
        if (parsedUserData.emailverified) {
          setIsEmailVerified(true);
        }
      }
    } catch (error) {
      console.error("Error parsing user data from sessionStorage:", error);
    }
  }, []);
  return (
    <div className="bg-card border border-border shadow-sm rounded-lg p-4 mb-6">
      <h2 className="text-foreground text-lg mb-4">Basic Settings</h2>

      <div className="mb-5">
        <label className="block mb-2 text-sm">User Name</label>
        <input
          type="text"
          value={formState.username}
          onChange={e => updateFormField("username", e.target.value)}
          onFocus={() => updateUiState({ focusedInput: "username" })}
          onBlur={() => updateUiState({ focusedInput: null })}
          className={getInputStyle("username")}
          style={{ outlineWidth: 0, boxShadow: "none" }}
        />
        <p className="text-muted-foreground italic text-xs mt-1">
          You can only change your display name once in a month.
        </p>
      </div>

      <div className="mb-5">
        <label className="block mb-2 text-sm">Email Address</label>
        <div className="relative ">
          {" "}
          <input
            type="text"
            value={formState.email}
            readOnly
            className={`${getInputStyle("email")} opacity-70`}
            style={{ outlineWidth: 0, boxShadow: "none" }}
          />
          <div className="absolute right-2 -translate-y-1/2 top-1/2">
            {isEmailVerified ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
            )}
          </div>
        </div>
        {!isEmailVerified && (
          <p className="text-muted-foreground italic text-xs mt-1">
            <Link href="/settings/privacy" className="text-purple-500">
              Click here
            </Link>{" "}
            to verify your email
          </p>
        )}
      </div>

      <div className="mb-5">
        <label className="block mb-2 text-sm">Edit Bio</label>
        <textarea
          value={formState.bio}
          onChange={e => updateFormField("bio", e.target.value)}
          onFocus={() => updateUiState({ focusedInput: "bio" })}
          onBlur={() => updateUiState({ focusedInput: null })}
          className={`${getInputStyle("bio")} min-h-[7em]`}
          style={{ outlineWidth: 0, boxShadow: "none", height: "7em" }}
        />
        <p className="text-muted-foreground italic text-xs mt-1">
          Share a bit about yourself. (Max 150 words)
        </p>
      </div>
    </div>
  );
}
