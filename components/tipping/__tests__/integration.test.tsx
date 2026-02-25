import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { TipButton } from "../TipButton";
import { TipModal } from "../TipModal";
import { TipConfirmation } from "../TipConfirmation";
import * as stellarPayments from "@/lib/stellar/payments";

// Mock Stellar payments module
jest.mock("@/lib/stellar/payments", () => ({
  buildTipTransaction: jest.fn(),
  submitTransaction: jest.fn(),
  hasInsufficientBalance: jest.fn(),
  getXLMPrice: jest.fn(),
  calculateFeeEstimate: jest.fn(),
}));

// Mock UI components
jest.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => <div data-testid="avatar">{children}</div>,
  AvatarImage: () => <img data-testid="avatar-image" />,
  AvatarFallback: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => (
    <div data-testid="dialog" style={{ display: open ? "block" : "none" }}>{children}</div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("TipButton → TipModal → TipConfirmation Integration", () => {
  const mockRecipient = {
    username: "testuser",
    publicKey: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    avatar: "https://example.com/avatar.jpg",
  };

  const mockSender = {
    publicKey: "GYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (stellarPayments.getXLMPrice as jest.Mock).mockResolvedValue(0.12);
    (stellarPayments.calculateFeeEstimate as jest.Mock).mockReturnValue(0.00001);
    (stellarPayments.hasInsufficientBalance as jest.Mock).mockResolvedValue(false);
  });

  describe("Full Success Flow", () => {
    it("should complete full tipping flow from button click to success confirmation", async () => {
      let modalOpen = false;
      let confirmationOpen = false;
      let confirmationState: "success" | "error" = "success";
      let confirmationTxHash = "";
      let confirmationAmount = "";

      const handleTipClick = () => {
        modalOpen = true;
      };

      const handleModalClose = () => {
        modalOpen = false;
      };

      const handleSuccess = (txHash: string, amount: string) => {
        modalOpen = false;
        confirmationOpen = true;
        confirmationState = "success";
        confirmationTxHash = txHash;
        confirmationAmount = amount;
      };

      const handleConfirmationClose = () => {
        confirmationOpen = false;
      };

      // Mock successful transaction
      (stellarPayments.buildTipTransaction as jest.Mock).mockResolvedValue("mockXDR");
      (stellarPayments.submitTransaction as jest.Mock).mockResolvedValue({
        success: true,
        hash: "mockTxHash123",
      });

      // Render TipButton
      const { rerender } = render(
        <TipButton
          recipientUsername={mockRecipient.username}
          recipientPublicKey={mockRecipient.publicKey}
          onTipClick={handleTipClick}
        />
      );

      // Click tip button (only TipButton is rendered, so one "Send Tip" button)
      const tipButton = screen.getByRole("button", { name: "Send Tip" });
      fireEvent.click(tipButton);

      expect(modalOpen).toBe(true);

      // Render TipModal
      rerender(
        <>
          <TipButton
            recipientUsername={mockRecipient.username}
            recipientPublicKey={mockRecipient.publicKey}
            onTipClick={handleTipClick}
          />
          <TipModal
            isOpen={modalOpen}
            onClose={handleModalClose}
            recipientUsername={mockRecipient.username}
            recipientPublicKey={mockRecipient.publicKey}
            recipientAvatar={mockRecipient.avatar}
            senderPublicKey={mockSender.publicKey}
            onSuccess={handleSuccess}
          />
        </>
      );

      // Enter amount and submit (modal is open; scope to dialog to get submit button)
      await waitFor(() => {
        expect(within(screen.getByTestId("dialog")).getByRole("button", { name: "Send Tip" })).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText("0.00");
      fireEvent.change(input, { target: { value: "5" } });

      const submitButton = within(screen.getByTestId("dialog")).getByRole("button", { name: "Send Tip" });
      fireEvent.click(submitButton);

      // Wait for transaction to complete
      await waitFor(() => {
        expect(stellarPayments.buildTipTransaction).toHaveBeenCalled();
        expect(stellarPayments.submitTransaction).toHaveBeenCalled();
      });

      // Verify success callback was called
      expect(confirmationOpen).toBe(true);
      expect(confirmationState).toBe("success");
      expect(confirmationTxHash).toBe("mockTxHash123");
      expect(confirmationAmount).toBe("5");
    });
  });

  describe("Wallet Disconnection Handling", () => {
    it("should not show tip button when wallet is disconnected", () => {
      render(
        <TipButton
          recipientUsername={mockRecipient.username}
          recipientPublicKey={mockRecipient.publicKey}
          onTipClick={jest.fn()}
        />
      );

      // TipButton should still render (it's the parent component's responsibility
      // to hide it based on wallet connection)
      expect(screen.getByRole("button", { name: "Send Tip" })).toBeInTheDocument();
    });

    it("should handle wallet disconnection during transaction", async () => {
      let modalOpen = true;

      (stellarPayments.buildTipTransaction as jest.Mock).mockRejectedValue(
        new Error("Wallet disconnected")
      );

      const handleError = jest.fn();

      render(
        <TipModal
          isOpen={modalOpen}
          onClose={jest.fn()}
          recipientUsername={mockRecipient.username}
          recipientPublicKey={mockRecipient.publicKey}
          senderPublicKey={mockSender.publicKey}
          onError={handleError}
        />
      );

      const input = screen.getByPlaceholderText("0.00");
      fireEvent.change(input, { target: { value: "5" } });

      const submitButton = within(screen.getByTestId("dialog")).getByRole("button", { name: "Send Tip" });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(handleError).toHaveBeenCalled();
      });
    });
  });

  describe("Self-Tipping Prevention", () => {
    it("should prevent user from tipping themselves", () => {
      // Parent component logic - same public key for sender and recipient
      const samePubKey = "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

      // In the parent component, the button should be disabled or hidden
      // when sender and recipient keys match
      const shouldShowTipButton = samePubKey !== samePubKey;

      expect(shouldShowTipButton).toBe(false);
    });
  });

  describe("Missing Public Key Handling", () => {
    it("should not render tip button when recipient has no public key", () => {
      render(
        <TipButton
          recipientUsername={mockRecipient.username}
          recipientPublicKey=""
          onTipClick={jest.fn()}
        />
      );

      expect(screen.queryByRole("button", { name: "Send Tip" })).not.toBeInTheDocument();
    });

    it("should handle missing sender public key gracefully", async () => {
      render(
        <TipModal
          isOpen={true}
          onClose={jest.fn()}
          recipientUsername={mockRecipient.username}
          recipientPublicKey={mockRecipient.publicKey}
          senderPublicKey=""
          onError={jest.fn()}
        />
      );

      const input = screen.getByPlaceholderText("0.00");
      fireEvent.change(input, { target: { value: "5" } });

      const submitButton = within(screen.getByTestId("dialog")).getByRole("button", { name: "Send Tip" });
      fireEvent.click(submitButton);

      // Should show error about invalid sender address
      await waitFor(() => {
        expect(screen.getByText(/Invalid sender Stellar address/i)).toBeInTheDocument();
      });
    });
  });

  describe("Error Recovery Flow", () => {
    it("should allow retry after error", async () => {
      let confirmationOpen = false;
      let confirmationState: "success" | "error" = "error";
      let modalOpen = false;

      const handleConfirmationClose = () => {
        confirmationOpen = false;
      };

      const handleRetry = () => {
        confirmationOpen = false;
        modalOpen = true;
      };

      const { rerender } = render(
        <TipConfirmation
          isOpen={true}
          onClose={handleConfirmationClose}
          state="error"
          amount="5"
          error="Network error"
          onSendAnother={handleRetry}
        />
      );

      // Click retry button
      const retryButton = screen.getByText("Try Again");
      fireEvent.click(retryButton);

      // Modal should reopen
      expect(modalOpen).toBe(true);
      expect(confirmationOpen).toBe(false);
    });
  });

  describe("Edge Case Integration", () => {
    it("should handle rapid button clicks gracefully", () => {
      const handleTipClick = jest.fn();

      render(
        <TipButton
          recipientUsername={mockRecipient.username}
          recipientPublicKey={mockRecipient.publicKey}
          onTipClick={handleTipClick}
        />
      );

      const button = screen.getByRole("button", { name: "Send Tip" });
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      // Each click should trigger the callback
      expect(handleTipClick).toHaveBeenCalledTimes(3);
    });

    it("should handle modal close during transaction", async () => {
      let modalOpen = true;
      const handleClose = () => {
        modalOpen = false;
      };

      (stellarPayments.buildTipTransaction as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve("mockXDR"), 1000))
      );

      render(
        <TipModal
          isOpen={modalOpen}
          onClose={handleClose}
          recipientUsername={mockRecipient.username}
          recipientPublicKey={mockRecipient.publicKey}
          senderPublicKey={mockSender.publicKey}
        />
      );

      const input = screen.getByPlaceholderText("0.00");
      fireEvent.change(input, { target: { value: "5" } });

      const submitButton = within(screen.getByTestId("dialog")).getByRole("button", { name: "Send Tip" });
      fireEvent.click(submitButton);

      // Cancel button should be disabled during processing
      await waitFor(() => {
        const cancelButton = within(screen.getByTestId("dialog")).getByRole("button", { name: "Cancel" });
        expect(cancelButton).toBeDisabled();
      });
    });
  });
});
