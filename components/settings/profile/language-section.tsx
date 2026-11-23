"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

import type { FormState, UIState } from "@/types/settings/profile";
import {
  getLanguageName,
  type LanguageCode,
  type SupportedLanguage,
} from "@/lib/i18n/languages";

interface LanguageSectionProps {
  formState: FormState;
  updateUiState: (updates: Partial<UIState>) => void;
  uiState: UIState;
  languages: readonly SupportedLanguage[];
  handleLanguageSelect: (language: LanguageCode) => void;
  disabled?: boolean;
  error?: string | null;
}

export function LanguageSection({
  formState,
  updateUiState,
  uiState,
  languages,
  handleLanguageSelect,
  disabled = false,
  error,
}: LanguageSectionProps) {
  return (
    <>
      <motion.div
        className="bg-card border border-border shadow-sm rounded-lg p-4 mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <h2 className="text-foreground text-lg mb-4">Language</h2>
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-label="Select language"
          className={`w-full bg-input rounded-lg px-4 py-3 text-sm flex justify-between items-center text-left disabled:opacity-50 disabled:cursor-not-allowed ${
            uiState.focusedInput === "language"
              ? "border border-purple-600"
              : "border border-transparent"
          } transition-all duration-200`}
          onClick={() =>
            updateUiState({
              focusedInput: "language",
              showLanguageModal: true,
            })
          }
        >
          <span>{getLanguageName(formState.language)}</span>
          <svg
            width="12"
            height="8"
            viewBox="0 0 12 8"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M1 1.5L6 6.5L11 1.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-500">
            {error}
          </p>
        )}
      </motion.div>

      {/* Language Modal */}
      <AnimatePresence>
        {uiState.showLanguageModal && (
          <motion.div
            className="bg-overlay fixed inset-0 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="profile-language-heading"
              className="bg-modal border border-border shadow-sm rounded-lg w-full max-w-md p-6 relative"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex justify-between items-center mb-6">
                <h2
                  id="profile-language-heading"
                  className="text-highlight text-xl font-medium"
                >
                  Select Language
                </h2>
                <motion.button
                  type="button"
                  aria-label="Close language selector"
                  onClick={() => updateUiState({ showLanguageModal: false })}
                  className="text-muted-foreground hover:text-white"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X size={24} />
                </motion.button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto">
                {languages.map((lang, index) => (
                  <motion.button
                    type="button"
                    key={lang.code}
                    onClick={() => handleLanguageSelect(lang.code)}
                    className={`flex items-center gap-3 p-3 rounded-md cursor-pointer text-left ${
                      formState.language === lang.code
                        ? "bg-purple-900 bg-opacity-50"
                        : "bg-input hover:bg-surface-hover"
                    }`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="text-sm">{lang.name}</span>
                    {formState.language === lang.code && (
                      <span className="ml-auto w-2 h-2 rounded-full bg-purple-500"></span>
                    )}
                  </motion.button>
                ))}
              </div>

              <div className="mt-6 flex justify-end">
                <motion.button
                  onClick={() => updateUiState({ showLanguageModal: false })}
                  className="bg-highlight hover:bg-highlight/80 text-primary-foreground px-6 py-2 rounded-md text-sm"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Close
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
