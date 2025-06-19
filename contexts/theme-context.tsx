"use client";

import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  effectiveTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">(
    "light"
  );
  const [isInitialized, setIsInitialized] = useState(false);

  // Load theme from localStorage and apply immediately
  useEffect(() => {
    // Get system theme for initial state
    const getSystemTheme = () => {
      if (typeof window !== "undefined") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
      return "light";
    };

    const systemTheme = getSystemTheme();

    // Try to get saved theme
    const savedTheme = localStorage.getItem("streamfi-theme") as Theme;

    let themeToUse: Theme = "system";
    let effectiveThemeToUse: "light" | "dark" = systemTheme;

    if (savedTheme && ["light", "dark", "system"].includes(savedTheme)) {
      themeToUse = savedTheme;

      if (savedTheme === "system") {
        effectiveThemeToUse = systemTheme;
      } else {
        effectiveThemeToUse = savedTheme;
      }
    } else {
      // If no valid theme is saved, default to system
      themeToUse = "system";
      effectiveThemeToUse = systemTheme;
    }

    // Apply theme immediately to prevent flashing
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(effectiveThemeToUse);

    // Set states
    setTheme(themeToUse);
    setEffectiveTheme(effectiveThemeToUse);
    setIsInitialized(true);

    // Save to localStorage
    localStorage.setItem("streamfi-theme", themeToUse);
  }, []);

  // Update effective theme based on theme setting
  useEffect(() => {
    if (!isInitialized) return;

    const updateEffectiveTheme = () => {
      let newEffectiveTheme: "light" | "dark";

      if (theme === "system") {
        newEffectiveTheme = window.matchMedia("(prefers-color-scheme: dark)")
          .matches
          ? "dark"
          : "light";
      } else {
        newEffectiveTheme = theme;
      }

      setEffectiveTheme(newEffectiveTheme);

      // Apply theme to document immediately
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(newEffectiveTheme);
    };

    updateEffectiveTheme();

    // Listen for system theme changes
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      mediaQuery.addEventListener("change", updateEffectiveTheme);
      return () =>
        mediaQuery.removeEventListener("change", updateEffectiveTheme);
    }
  }, [theme, isInitialized]);

  // Save theme to localStorage when it changes
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem("streamfi-theme", theme);
    }
  }, [theme, isInitialized]);

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider
      value={{ theme, effectiveTheme, setTheme: handleSetTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
