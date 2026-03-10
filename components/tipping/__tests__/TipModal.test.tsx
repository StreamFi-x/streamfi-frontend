import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const submitButton = screen.getByRole("button", { name: "Send Tip" });

      fireEvent.change(input, { target: { value: "-5" } });

      // -5 should be rejected by regex
      expect(input).toHaveValue("");
    });

    it("should show error for amount too small", async () => {
      render(<TipModal {...mockProps} />);

      const input = screen.getByPlaceholderText("0.00");
      const submitButton = screen.getByRole("button", { name: "Send Tip" });

      fireEvent.change(input, { target: { value: "0.00000001" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Amount is too small/i)).toBeInTheDocument();
      });
    });

    it("should show error for amount exceeding maximum (10,000 XLM)", async () => {
      render(<TipModal {...mockProps} />);

      const input = screen.getByPlaceholderText("0.00");
      const submitButton = screen.getByRole("button", { name: "Send Tip" });

      fireEvent.change(input, { target: { value: "10001" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Amount is too large/i)).toBeInTheDocument();
      });
    });

    it("should show error for zero amount", async () => {
      render(<TipModal {...mockProps} />);

      const input = screen.getByPlaceholderText("0.00");
      const submitButton = screen.getByRole("button", { name: "Send Tip" });

      fireEvent.change(input, { target: { value: "0" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Please enter a valid amount greater than 0/i)).toBeInTheDocument();
      });
    });
  });

  describe("Transaction State Transitions", () => {
    it("should transition through states on successful transaction", async () => {
      (stellarPayments.buildTipTransaction as jest.Mock).mockResolvedValue({} as any);
      (stellarPayments.submitTransaction as jest.Mock).mockResolvedValue({
        success: true,
        hash: "mockTxHash123",
      });

      const onSuccess = jest.fn();
      render(<TipModal {...mockProps} onSuccess={onSuccess} />);

      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText("0.00"), "5");
      await user.click(screen.getByRole("button", { name: "Send Tip" }));

      await waitFor(
        () => {
          expect(screen.getByText((c) => c.includes("XLM sent!"))).toBeInTheDocument();
          expect(onSuccess).toHaveBeenCalledWith("mockTxHash123", "5");
        },
        { timeout: 5000 }
      );
    });

    it("should handle transaction failure", async () => {
      (stellarPayments.buildTipTransaction as jest.Mock).mockRejectedValue(
        new Error("Network error")
      );

      const onError = jest.fn();
      render(<TipModal {...mockProps} onError={onError} />);

      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText("0.00"), "5");
      await user.click(screen.getByRole("button", { name: "Send Tip" }));

      await waitFor(
        () => {
          expect(screen.getByText((c) => c.includes("Network error"))).toBeInTheDocument();
          expect(onError).toHaveBeenCalled();
        },
        { timeout: 5000 }
      );
    });

    it("should handle user rejection", async () => {
      (stellarPayments.buildTipTransaction as jest.Mock).mockResolvedValue({} as any);
      (stellarPayments.submitTransaction as jest.Mock).mockRejectedValue(
        new Error("User declined")
      );

      render(<TipModal {...mockProps} />);

      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText("0.00"), "5");
      await user.click(screen.getByRole("button", { name: "Send Tip" }));

      await waitFor(
        () => {
          expect(screen.getByText((c) => c.includes("Transaction was cancelled"))).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle insufficient balance error", async () => {
      (stellarPayments.hasInsufficientBalance as jest.Mock).mockResolvedValue(true);

      const onError = jest.fn();
      render(<TipModal {...mockProps} onError={onError} />);

      const dialog = screen.getByTestId("dialog");
      // Use preset "5 XLM" so amount state is set reliably; flush before submit
      await act(async () => {
        fireEvent.click(within(dialog).getByText("5 XLM"));
      });
      expect(within(dialog).getByDisplayValue("5")).toBeInTheDocument();
      const submitButton = within(dialog).getByRole("button", { name: "Send Tip" });
      expect(submitButton).not.toBeDisabled();

      const user = userEvent.setup();
      await user.click(submitButton);
      await waitFor(
        () => {
          expect(within(dialog).getByText(/Insufficient balance/i)).toBeInTheDocument();
          expect(onError).toHaveBeenCalledWith("Insufficient balance");
        },
        { timeout: 5000 }
      );
    });

    it("should show retry button on error", async () => {
      (stellarPayments.hasInsufficientBalance as jest.Mock).mockResolvedValue(false);
      (stellarPayments.buildTipTransaction as jest.Mock).mockRejectedValue(
        new Error("Network error")
      );

      render(<TipModal {...mockProps} />);

      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText("0.00"), "5");
      await user.click(screen.getByRole("button", { name: "Send Tip" }));

      await waitFor(
        () => expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument(),
        { timeout: 5000 }
      );
    });

    it("should reset state on retry", async () => {
      (stellarPayments.hasInsufficientBalance as jest.Mock).mockResolvedValue(false);
      (stellarPayments.buildTipTransaction as jest.Mock).mockRejectedValue(
        new Error("Network error")
      );

      render(<TipModal {...mockProps} />);

      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText("0.00"), "5");
      await user.click(screen.getByRole("button", { name: "Send Tip" }));

      const retryButton = await waitFor(
        () => screen.getByRole("button", { name: "Try Again" }),
        { timeout: 5000 }
      );
      await user.click(retryButton);

      await waitFor(
        () => expect(screen.getByRole("button", { name: "Send Tip" })).toBeInTheDocument(),
        { timeout: 5000 }
      );
    });

    it("should validate invalid recipient public key", async () => {
      const invalidProps = {
        ...mockProps,
        recipientPublicKey: "INVALID_KEY",
      };

      render(<TipModal {...invalidProps} />);

      const input = screen.getByPlaceholderText("0.00");
      const submitButton = screen.getByRole("button", { name: "Send Tip" });

      fireEvent.change(input, { target: { value: "5" } });
      fireEvent.click(submitButton);

      expect(await screen.findByText(/Invalid recipient Stellar address/i)).toBeInTheDocument();
    });
  });

  describe("Success/Error States", () => {
    it("should display success state with transaction hash", async () => {
      (stellarPayments.hasInsufficientBalance as jest.Mock).mockResolvedValue(false);
      (stellarPayments.buildTipTransaction as jest.Mock).mockResolvedValue("mockXDR");
      (stellarPayments.submitTransaction as jest.Mock).mockResolvedValue({
        success: true,
        hash: "ABC123DEF456",
      });

      render(<TipModal {...mockProps} />);

      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText("0.00"), "5");
      await user.click(screen.getByRole("button", { name: "Send Tip" }));

      await waitFor(
        () => {
          expect(screen.getByText((c) => c.includes("XLM sent!"))).toBeInTheDocument();
          expect(screen.getByText(/View on Explorer/i)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });

    it("should show price fetch failure warning", async () => {
      (stellarPayments.getXLMPrice as jest.Mock).mockRejectedValue(new Error("API error"));

      render(<TipModal {...mockProps} />);

      await waitFor(
        () => {
          expect(screen.getByText((c) => c.includes("Unable to load current XLM price"))).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
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

    it("should prevent closing during transaction processing", async () => {
      (stellarPayments.hasInsufficientBalance as jest.Mock).mockResolvedValue(false);
      (stellarPayments.buildTipTransaction as jest.Mock).mockImplementation(
        () => new Promise(() => { }) // Never resolves
      );

      render(<TipModal {...mockProps} />);

      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText("0.00"), "5");
      await user.click(screen.getByRole("button", { name: "Send Tip" }));

      await waitFor(
        () => {
          const cancelButton = screen.getByRole("button", { name: "Cancel" });
          expect(cancelButton).toBeDisabled();
        },
        { timeout: 5000 }
      );
    });
  });
});
