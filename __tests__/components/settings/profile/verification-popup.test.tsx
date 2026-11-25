import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import VerificationPopup from "@/components/settings/profile/popup";

describe("VerificationPopup Accessibility & Dismissal (#1826)", () => {
  const defaultProps = {
    email: "test@example.com",
    onClose: jest.fn(),
    onVerify: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders with proper dialog semantics (role='dialog', aria-modal, aria-labelledby, aria-describedby)", () => {
    render(<VerificationPopup {...defaultProps} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "verification-dialog-title");
    expect(dialog).toHaveAttribute("aria-describedby", "verification-dialog-desc");

    expect(screen.getByText("Enter Verification code")).toHaveAttribute("id", "verification-dialog-title");
    expect(screen.getByText("Enter the 6-digit code sent to")).toHaveAttribute("id", "verification-dialog-desc");
  });

  it("renders a visible close button that dismisses the popup via click", () => {
    render(<VerificationPopup {...defaultProps} />);

    const closeButton = screen.getByRole("button", { name: /close verification popup/i });
    expect(closeButton).toBeInTheDocument();

    fireEvent.click(closeButton);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("dismisses the popup when the Escape key is pressed", () => {
    render(<VerificationPopup {...defaultProps} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("focuses the first digit input on mount", () => {
    render(<VerificationPopup {...defaultProps} />);

    const firstInput = screen.getByRole("textbox", { name: "Digit 1 of 6" });
    expect(document.activeElement).toBe(firstInput);
  });

  it("traps focus within the dialog when tabbing past the last element or shift-tabbing before the first element", () => {
    render(<VerificationPopup {...defaultProps} />);

    const closeButton = screen.getByRole("button", { name: /close verification popup/i });
    const resendButton = screen.getByRole("button", { name: /resend/i });

    // Focus on close button (first focusable) and press Shift+Tab -> should wrap to resend button (last focusable)
    act(() => {
      closeButton.focus();
    });
    expect(document.activeElement).toBe(closeButton);

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(resendButton);

    // Focus on resend button (last focusable) and press Tab -> should wrap to close button (first focusable)
    act(() => {
      resendButton.focus();
    });
    expect(document.activeElement).toBe(resendButton);

    fireEvent.keyDown(document, { key: "Tab", shiftKey: false });
    expect(document.activeElement).toBe(closeButton);
  });
});
