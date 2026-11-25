"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/theme-context";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { toast } from "sonner";

interface RadioOptionProps {
  label: string;
  isSelected: boolean;
  onSelect: () => void;
}

interface OptionsSectionProps {
  title: string;
  description: string;
  value: string;
  options: string[];
  onChange: (newValue: string) => void;
}

interface SectionCardProps {
  children: React.ReactNode;
}

const RadioOption: React.FC<RadioOptionProps> = ({
  label,
  isSelected,
  onSelect,
}) => {
  return (
    <div className="flex items-center">
      <button
        type="button"
        className={`w-8 h-8 rounded-full ${isSelected ? "bg-highlight" : "bg-muted"} flex items-center justify-center mr-3 transition-colors`}
        onClick={onSelect}
      >
        {isSelected && (
          <svg
            className="w-5 h-5 text-white"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M20 6L9 17L4 12"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
      <span className="text-foreground text-lg">{label}</span>
    </div>
  );
};

const SectionCard: React.FC<SectionCardProps> = ({ children }) => {
  return (
    <div className="bg-card border border-border shadow-sm rounded-lg p-6 mb-6">
      {children}
    </div>
  );
};

const OptionsSection: React.FC<OptionsSectionProps> = ({
  title,
  description,
  value,
  options,
  onChange,
}) => {
  const getDisplayLabel = (option: string) => {
    const labels: Record<string, string> = {
      light: "Light Mode",
      dark: "Dark Mode",
      system: "System Default",
    };
    return labels[option] || option;
  };

  return (
    <SectionCard>
      <h2 className="text-highlight text-xl font-medium mb-2">{title}</h2>
      <p className="text-muted-foreground text-sm mb-4 italic">{description}</p>

      <div className="space-y-4">
        {options.map(option => (
          <RadioOption
            key={option}
            label={getDisplayLabel(option)}
            isSelected={value === option}
            onSelect={() => onChange(option)}
          />
        ))}
      </div>
    </SectionCard>
  );
};

const ThemeSettingsPage: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { preferences, update } = useUserPreferences();
  const [selectedTheme, setSelectedTheme] = useState<"light" | "dark" | "system">(
    preferences?.theme || theme || "dark"
  );
  const [isSaving, setIsSaving] = useState(false);

  // Sync with theme context and preferences when loaded
  useEffect(() => {
    if (preferences?.theme) {
      setSelectedTheme(preferences.theme);
      setTheme(preferences.theme);
    } else if (theme) {
      setSelectedTheme(theme);
    }
  }, [preferences?.theme, theme, setTheme]);

  const handleThemeChange = (newTheme: string) => {
    const t = newTheme as "light" | "dark" | "system";
    setSelectedTheme(t);
    setTheme(t);
  };

  const saveChanges = async () => {
    try {
      setIsSaving(true);
      await update({ theme: selectedTheme });
      toast.success("Appearance settings saved successfully!");
    } catch (err) {
      console.error("Failed to persist theme preferences:", err);
      toast.error("Failed to save appearance settings to server");
    } finally {
      setIsSaving(false);
    }
  };

  const commonOptions = ["light", "dark", "system"];

  return (
    <div className="min-h-screen bg-secondary text-foreground">
      <div className="max-w-8xl mx-auto">
        <OptionsSection
          title="Theme"
          description="Choose between light, dark, and system interface themes"
          value={selectedTheme}
          options={commonOptions}
          onChange={handleThemeChange}
        />

        <div className="lg:flex lg:justify-end w-full">
          <button
            type="button"
            disabled={isSaving}
            className="bg-highlight hover:bg-highlight/80 disabled:opacity-50 text-primary-foreground w-full lg:w-[12em] px-6 py-3 rounded-lg font-medium transition-colors"
            onClick={saveChanges}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThemeSettingsPage;
