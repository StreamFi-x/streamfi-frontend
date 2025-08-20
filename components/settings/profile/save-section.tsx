"use client";
import { motion } from "framer-motion";

import type { UIState } from "@/types/settings/profile";

interface SaveSectionProps {
  uiState: UIState;
  handleSaveChanges: () => void;
}

export function SaveSection({ uiState, handleSaveChanges }: SaveSectionProps) {
  return (
    <motion.div
      className="flex justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      {uiState.saveError && (
        <p className="text-error mr-4 self-center">{uiState.saveError}</p>
      )}
      {uiState.saveSuccess && (
        <p className="text-success mr-4 self-center">
          Changes saved successfully!
        </p>
      )}
      <motion.button
        onClick={handleSaveChanges}
        disabled={uiState.isSaving}
        className="bg-highlight hover:bg-highlight/80 text-primary-foreground mr-4 px-6 py-3 rounded-md text-sm disabled:opacity-50"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {uiState.isSaving ? "Saving..." : "Save Changes"}
      </motion.button>
    </motion.div>
  );
}
