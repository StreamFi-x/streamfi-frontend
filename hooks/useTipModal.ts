import { useState, useCallback } from "react";

export interface TipConfirmationState {
  show: boolean;
  state: "success" | "error";
  amount: string;
  txHash?: string;
  error?: string;
}

/**
 * Hook to manage tip modal and confirmation state
 * Provides methods to show/hide modals and update confirmation state
 */
export function useTipModal() {
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipConfirmation, setTipConfirmation] = useState<TipConfirmationState>({
    show: false,
    state: "success",
    amount: "",
  });

  const openTipModal = useCallback(() => {
    setShowTipModal(true);
  }, []);

  const closeTipModal = useCallback(() => {
    setShowTipModal(false);
  }, []);

  const showSuccess = useCallback((txHash: string, amount: string) => {
    setShowTipModal(false);
    setTipConfirmation(prev => ({
      ...prev,
      show: true,
      state: "success",
      amount,
      txHash,
    }));
  }, []);

  const showError = useCallback((error: string) => {
    setShowTipModal(false);
    setTipConfirmation(prev => ({
      ...prev,
      show: true,
      state: "error",
      error,
      amount: "",
    }));
  }, []);

  const closeConfirmation = useCallback(() => {
    setTipConfirmation(prev => ({ ...prev, show: false }));
  }, []);

  const retryFromConfirmation = useCallback(() => {
    setTipConfirmation(prev => ({ ...prev, show: false }));
    setShowTipModal(true);
  }, []);

  return {
    // State
    showTipModal,
    tipConfirmation,
    // Actions
    openTipModal,
    closeTipModal,
    showSuccess,
    showError,
    closeConfirmation,
    retryFromConfirmation,
  };
}
