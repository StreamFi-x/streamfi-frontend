"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/auth/auth-provider";

const SKIP_PREFIXES = ["/onboarding", "/settings", "/admin", "/api"];
const SNOOZE_KEY = "username_prompt_snoozed_until";
const SNOOZE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export default function UsernamePromptModal() {
  const { user, isInitializing, updateUserProfile, refreshUser } = useAuth();
  const pathname = usePathname();

  const [dismissed, setDismissed] = useState(false);
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Check whether the snooze window is still active on mount
  useEffect(() => {
    try {
      const snoozedUntil = localStorage.getItem(SNOOZE_KEY);
      if (snoozedUntil && Date.now() < Number(snoozedUntil)) {
        setDismissed(true);
      }
    } catch {
      // localStorage unavailable (SSR / private-browse guard)
    }
  }, []);

  const onSkippedPage = SKIP_PREFIXES.some(p => pathname.startsWith(p));
  // username can arrive as null from the DB even though the TS type says string
  const hasNoUsername = user && (!user.username || user.username === "");
  const shouldShow =
    hasNoUsername && !isInitializing && !dismissed && !onSkippedPage;

  const validate = (value: string): string => {
    const v = value.trim();
    if (!v) {
      return "Username is required";
    }
    if (v.length < 3) {
      return "Must be at least 3 characters";
    }
    if (v.length > 30) {
      return "Must be 30 characters or fewer";
    }
    if (!/^[a-zA-Z0-9_]+$/.test(v)) {
      return "Only letters, numbers, and underscores";
    }
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate(username);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const result = await updateUserProfile({ username: username.trim() });
      if (result.success) {
        try {
          sessionStorage.setItem("username", username.trim());
        } catch {
          // ignore
        }
        await refreshUser();
        setSaved(true);
        // Auto-close after brief success flash
        setTimeout(() => setDismissed(true), 1200);
      } else {
        setError(result.error ?? "That username is already taken or invalid");
      }
    } catch {
      setError("Something went wrong — please try again");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLater = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DURATION_MS));
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop — clicking it dismisses */}
          <div className="absolute inset-0 bg-black/60" onClick={handleLater} />

          <motion.div
            className="relative bg-[#1A1A1A] rounded-xl w-full max-w-sm p-6 z-10 shadow-2xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-white mb-1">
                Choose a username
              </h2>
              <p className="text-sm text-gray-400">
                Pick a unique username so others can find and follow you on
                StreamFi.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <input
                  type="text"
                  value={username}
                  onChange={e => {
                    setUsername(e.target.value);
                    setError("");
                  }}
                  placeholder="e.g. cool_streamer"
                  maxLength={30}
                  autoFocus
                  className="w-full bg-[#2D2F31] text-white text-sm rounded-md px-3 py-3 focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder:text-gray-500"
                />
                {error && (
                  <p className="text-red-400 text-xs mt-1.5">{error}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || !username.trim()}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-md transition-colors"
              >
                {saved ? "Saved!" : isLoading ? "Saving…" : "Set username"}
              </button>

              <button
                type="button"
                onClick={handleLater}
                className="w-full text-gray-500 hover:text-gray-300 text-sm py-1.5 transition-colors"
              >
                Later
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
