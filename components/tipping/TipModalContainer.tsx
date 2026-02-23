"use client";

import { TipModal } from "./TipModal";
import { TipConfirmation } from "./TipConfirmation";
import type { TipConfirmationState } from "@/hooks/useTipModal";

interface TipModalContainerProps {
  // TipModal props
  isModalOpen: boolean;
  onModalClose: () => void;
  recipientUsername: string;
  recipientPublicKey: string;
  recipientAvatar?: string;
  senderPublicKey: string;
  onSuccess: (txHash: string, amount: string) => void;
  onError: (error: string) => void;

  // TipConfirmation props
  confirmationState: TipConfirmationState;
  onConfirmationClose: () => void;
  onRetry: () => void;
}

/**
 * Container component that manages both TipModal and TipConfirmation
 * Eliminates duplication of modal rendering logic across components
 */
export function TipModalContainer({
  isModalOpen,
  onModalClose,
  recipientUsername,
  recipientPublicKey,
  recipientAvatar,
  senderPublicKey,
  onSuccess,
  onError,
  confirmationState,
  onConfirmationClose,
  onRetry,
}: TipModalContainerProps) {
  return (
    <>
      {recipientPublicKey && senderPublicKey && (
        <TipModal
          isOpen={isModalOpen}
          onClose={onModalClose}
          recipientUsername={recipientUsername}
          recipientPublicKey={recipientPublicKey}
          recipientAvatar={recipientAvatar}
          senderPublicKey={senderPublicKey}
          onSuccess={onSuccess}
          onError={onError}
        />
      )}

      <TipConfirmation
        isOpen={confirmationState.show}
        onClose={onConfirmationClose}
        state={confirmationState.state}
        amount={confirmationState.amount}
        txHash={confirmationState.txHash}
        error={confirmationState.error}
        onRetry={onRetry}
      />
    </>
  );
}
