"use client";
import {
  bgClasses,
  textClasses,
  componentClasses,
  combineClasses,
} from "@/lib/theme-classes";
import type { FormState, UIState } from "@/types/settings/profile";

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
  const getInputStyle = (inputName: string) => {
    return combineClasses(
      "w-full",
      bgClasses.input,
      "rounded-lg px-4 py-3 text-sm outline-none",
      uiState.focusedInput === inputName
        ? "border border-purple-600"
        : "border border-transparent",
      "transition-all duration-200",
    );
  };

  return (
    <div className={combineClasses(componentClasses.card, "p-4 mb-6")}>
      <h2 className={combineClasses(textClasses.primary, "text-lg mb-4")}>
        Basic Settings
      </h2>

      <div className="mb-5">
        <label className="block mb-2 text-sm">User Name</label>
        <input
          type="text"
          value={formState.username}
          onChange={(e) => updateFormField("username", e.target.value)}
          onFocus={() => updateUiState({ focusedInput: "username" })}
          onBlur={() => updateUiState({ focusedInput: null })}
          className={getInputStyle("username")}
          style={{ outlineWidth: 0, boxShadow: "none" }}
        />
        <p
          className={combineClasses(
            textClasses.tertiary,
            "italic text-xs mt-1",
          )}
        >
          You can only change your display name once in a month.
        </p>
      </div>

      <div className="mb-5">
        <label className="block mb-2 text-sm">Wallet Address</label>
        <input
          type="text"
          value={formState.wallet}
          readOnly
          className={combineClasses(getInputStyle("wallet"), "opacity-70")}
          style={{ outlineWidth: 0, boxShadow: "none" }}
        />
        <p
          className={combineClasses(
            textClasses.tertiary,
            "italic text-xs mt-1",
          )}
        >
          Your wallet address cannot be changed.
        </p>
      </div>

      <div className="mb-5">
        <label className="block mb-2 text-sm">Edit Bio</label>
        <textarea
          value={formState.bio}
          onChange={(e) => updateFormField("bio", e.target.value)}
          onFocus={() => updateUiState({ focusedInput: "bio" })}
          onBlur={() => updateUiState({ focusedInput: null })}
          className={combineClasses(getInputStyle("bio"), "min-h-[7em]")}
          style={{ outlineWidth: 0, boxShadow: "none", height: "7em" }}
        />
        <p
          className={combineClasses(
            textClasses.tertiary,
            "italic text-xs mt-1",
          )}
        >
          Share a bit about yourself. (Max 150 words)
        </p>
      </div>
    </div>
  );
}
