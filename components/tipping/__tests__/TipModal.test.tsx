import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TipModal } from "../TipModal";
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

describe("TipModal", () => {
  const mockProps = {
    isOpen: true,
    onClose: jest.fn(),
    recipientUsername: "testuser",
    recipientPublicKey: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    senderPublicKey: "GYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY",
    recipientAvatar: "https://example.com/avatar.jpg",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (stellarPayments.getXLMPrice as jest.Mock).mockResolvedValue(0.12);
    (stellarPayments.calculateFeeEstimate as jest.Mock).mockReturnValue(0.00001);
    (stellarPayments.hasInsufficientBalance as jest.Mock).mockResolvedValue(false);
  });

  describe("Preset Amount Selection", () => {
    it("should render preset amount buttons", () => {
      render(<TipModal {...mockProps} />);

      expect(screen.getByText("1 XLM")).toBeInTheDocument();
      expect(screen.getByText("5 XLM")).toBeInTheDocument();
      expect(screen.getByText("10 XLM")).toBeInTheDocument();
      expect(screen.getByText("25 XLM")).toBeInTheDocument();
    });

    it("should select preset amount when clicked", async () => {
      render(<TipModal {...mockProps} />);

      const fiveXlmButton = screen.getByText("5 XLM");
      fireEvent.click(fiveXlmButton);

      await waitFor(() => {
        const input = screen.getByPlaceholderText("0.00") as HTMLInputElement;
        expect(input.value).toBe("5");
      });
    });

    it("should update amount when different preset is selected", async () => {
      render(<TipModal {...mockProps} />);

      fireEvent.click(screen.getByText("5 XLM"));

      await waitFor(() => {
        const input = screen.getByPlaceholderText("0.00") as HTMLInputElement;
        expect(input.value).toBe("5");
      });

      fireEvent.click(screen.getByText("10 XLM"));

      await waitFor(() => {
        const input = screen.getByPlaceholderText("0.00") as HTMLInputElement;
        expect(input.value).toBe("10");
      });
    });
  });

  describe("Custom Amount Validation", () => {
    it("should allow valid decimal numbers", async () => {
      const user = userEvent.setup();
      render(<TipModal {...mockProps} />);

      const input = screen.getByPlaceholderText("0.00");
      await user.type(input, "12.5");

      expect(input).toHaveValue("12.5");
    });

    it("should reject non-numeric input", async () => {
      const user = userEvent.setup();
      render(<TipModal {...mockProps} />);

      const input = screen.getByPlaceholderText("0.00");
      await user.type(input, "abc");

      expect(input).toHaveValue("");
    });

    it("should show error for negative amounts", async () => {
      render(<TipModal {...mockProps} />);

      const input = screen.getByPlaceholderText("0.00");
      const submitButton = screen.getByText("Send Tip");

      fireEvent.change(input, { target: { value: "-5" } });

      // -5 should be rejected by regex
      expect(input).toHaveValue("");
    });

    it("should show error for amount too small", async () => {
      render(<TipModal {...mockProps} />);

      const input = screen.getByPlaceholderText("0.00");
      const submitButton = screen.getByText("Send Tip");

      fireEvent.change(input, { target: { value: "0.00000001" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Amount is too small/i)).toBeInTheDocument();
      });
    });

    it("should show error for amount exceeding maximum (10,000 XLM)", async () => {
      render(<TipModal {...mockProps} />);

      const input = screen.getByPlaceholderText("0.00");
      const submitButton = screen.getByText("Send Tip");

      fireEvent.change(input, { target: { value: "10001" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Amount is too large/i)).toBeInTheDocument();
      });
    });

    it("should show error for zero amount", async () => {
      render(<TipModal {...mockProps} />);

      const input = screen.getByPlaceholderText("0.00");
      const submitButton = screen.getByText("Send Tip");

      fireEvent.change(input, { target: { value: "0" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Please enter a valid amount greater than 0/i)).toBeInTheDocument();
      });
    });
  });

  describe("Transaction State Transitions", () => {
    it("should transition through states on successful transaction", async () => {
      (stellarPayments.buildTipTransaction as jest.Mock).mockResolvedValue("mockXDR");
      (stellarPayments.submitTransaction as jest.Mock).mockResolvedValue({
        success: true,
        hash: "mockTxHash123",
      });

      const onSuccess = jest.fn();
      render(<TipModal {...mockProps} onSuccess={onSuccess} />);

      const input = screen.getByPlaceholderText("0.00");
      const submitButton = screen.getByText("Send Tip");

      fireEvent.change(input, { target: { value: "5" } });
      fireEvent.click(submitButton);

      // Building state
      await waitFor(() => {
        expect(screen.getByText(/Building transaction/i)).toBeInTheDocument();
      });

      // Success state
      await waitFor(() => {
        expect(screen.getByText("5 XLM sent!")).toBeInTheDocument();
        expect(onSuccess).toHaveBeenCalledWith("mockTxHash123", "5");
      });
    });

    it("should handle transaction failure", async () => {
      (stellarPayments.buildTipTransaction as jest.Mock).mockRejectedValue(
        new Error("Network error")
      );

      const onError = jest.fn();
      render(<TipModal {...mockProps} onError={onError} />);

      const input = screen.getByPlaceholderText("0.00");
      const submitButton = screen.getByText("Send Tip");

      fireEvent.change(input, { target: { value: "5" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
        expect(onError).toHaveBeenCalled();
      });
    });

    it("should handle user rejection", async () => {
      (stellarPayments.buildTipTransaction as jest.Mock).mockResolvedValue("mockXDR");
      (stellarPayments.submitTransaction as jest.Mock).mockRejectedValue(
        new Error("User declined")
      );

      render(<TipModal {...mockProps} />);

      const input = screen.getByPlaceholderText("0.00");
      const submitButton = screen.getByText("Send Tip");

      fireEvent.change(input, { target: { value: "5" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Transaction was cancelled/i)).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle insufficient balance error", async () => {
      (stellarPayments.hasInsufficientBalance as jest.Mock).mockResolvedValue(true);

      const onError = jest.fn();
      render(<TipModal {...mockProps} onError={onError} />);

      const input = screen.getByPlaceholderText("0.00");
      const submitButton = screen.getByText("Send Tip");

      fireEvent.change(input, { target: { value: "5" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Insufficient balance/i)).toBeInTheDocument();
        expect(onError).toHaveBeenCalledWith("Insufficient balance");
      });
    });

    it("should show retry button on error", async () => {
      (stellarPayments.buildTipTransaction as jest.Mock).mockRejectedValue(
        new Error("Network error")
      );

      render(<TipModal {...mockProps} />);

      const input = screen.getByPlaceholderText("0.00");
      const submitButton = screen.getByText("Send Tip");

      fireEvent.change(input, { target: { value: "5" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Try Again")).toBeInTheDocument();
      });
    });

    it("should reset state on retry", async () => {
      (stellarPayments.buildTipTransaction as jest.Mock).mockRejectedValue(
        new Error("Network error")
      );

      render(<TipModal {...mockProps} />);

      const input = screen.getByPlaceholderText("0.00");
      let submitButton = screen.getByText("Send Tip");

      fireEvent.change(input, { target: { value: "5" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Try Again")).toBeInTheDocument();
      });

      const retryButton = screen.getByText("Try Again");
      fireEvent.click(retryButton);

      await waitFor(() => {
        submitButton = screen.getByText("Send Tip");
        expect(submitButton).toBeInTheDocument();
      });
    });

    it("should validate invalid recipient public key", async () => {
      const invalidProps = {
        ...mockProps,
        recipientPublicKey: "INVALID_KEY",
      };

      render(<TipModal {...invalidProps} />);

      const input = screen.getByPlaceholderText("0.00");
      const submitButton = screen.getByText("Send Tip");

      fireEvent.change(input, { target: { value: "5" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Invalid recipient Stellar address/i)).toBeInTheDocument();
      });
    });
  });

  describe("Success/Error States", () => {
    it("should display success state with transaction hash", async () => {
      (stellarPayments.buildTipTransaction as jest.Mock).mockResolvedValue("mockXDR");
      (stellarPayments.submitTransaction as jest.Mock).mockResolvedValue({
        success: true,
        hash: "ABC123DEF456",
      });

      render(<TipModal {...mockProps} />);

      const input = screen.getByPlaceholderText("0.00");
      const submitButton = screen.getByText("Send Tip");

      fireEvent.change(input, { target: { value: "5" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("5 XLM sent!")).toBeInTheDocument();
        expect(screen.getByText(/View on Explorer/i)).toBeInTheDocument();
      });
    });

    it("should show price fetch failure warning", async () => {
      (stellarPayments.getXLMPrice as jest.Mock).mockRejectedValue(new Error("API error"));

      render(<TipModal {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Unable to load current XLM price/i)).toBeInTheDocument();
      });
    });
  });

  describe("Modal Behavior", () => {
    it("should call onClose when close button is clicked", () => {
      render(<TipModal {...mockProps} />);

      const cancelButton = screen.getByText("Cancel");
      fireEvent.click(cancelButton);

      expect(mockProps.onClose).toHaveBeenCalled();
    });

    it("should reset state when modal closes", async () => {
      const { rerender } = render(<TipModal {...mockProps} />);

      const input = screen.getByPlaceholderText("0.00");
      fireEvent.change(input, { target: { value: "5" } });

      expect(input).toHaveValue("5");

      rerender(<TipModal {...mockProps} isOpen={false} />);
      rerender(<TipModal {...mockProps} isOpen={true} />);

      await waitFor(() => {
        const resetInput = screen.getByPlaceholderText("0.00") as HTMLInputElement;
        expect(resetInput.value).toBe("");
      });
    });

    it("should prevent closing during transaction processing", () => {
      (stellarPayments.buildTipTransaction as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<TipModal {...mockProps} />);

      const input = screen.getByPlaceholderText("0.00");
      const submitButton = screen.getByText("Send Tip");

      fireEvent.change(input, { target: { value: "5" } });
      fireEvent.click(submitButton);

      // Try to close - should not work during processing
      const cancelButton = screen.getByText("Cancel");
      expect(cancelButton).toBeDisabled();
    });
  });
});
