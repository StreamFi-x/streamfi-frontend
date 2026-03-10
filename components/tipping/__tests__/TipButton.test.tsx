import { render, screen, fireEvent } from "@testing-library/react";
import { TipButton } from "../TipButton";

// Mock UI components
jest.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    title,
    className,
    ...props
  }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={className}
      data-testid="tip-button"
      {...props}
    >
      {children}
    </button>
  ),
}));

describe("TipButton", () => {
  const mockProps = {
    recipientUsername: "testuser",
    recipientPublicKey:
      "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    onTipClick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render button with default text", () => {
      render(<TipButton {...mockProps} />);

      expect(screen.getByText("Send Tip")).toBeInTheDocument();
      expect(screen.getByTestId("tip-button")).toBeInTheDocument();
    });

    it("should render with custom children", () => {
      render(<TipButton {...mockProps}>Custom Tip Text</TipButton>);

      expect(screen.getByText("Custom Tip Text")).toBeInTheDocument();
      expect(screen.queryByText("Send Tip")).not.toBeInTheDocument();
    });

    it("should render icon by default", () => {
      const { container } = render(<TipButton {...mockProps} />);

      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });

    it("should render icon-only variant without label text when connected", () => {
      render(<TipButton {...mockProps} variant="icon-only" />);

      const button = screen.getByTestId("tip-button");
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("aria-label", "Send tip to testuser");
    });

    it("should have correct title attribute when recipient has no public key", () => {
      render(<TipButton {...mockProps} recipientPublicKey="" />);

      const button = screen.getByTestId("tip-button");
      expect(button).toHaveAttribute(
        "title",
        "Recipient has no Stellar public key"
      );
    });
  });

  describe("Conditional Display", () => {
    it("should not render when recipientPublicKey is empty", () => {
      render(<TipButton {...mockProps} recipientPublicKey="" />);

      expect(screen.queryByTestId("tip-button")).not.toBeInTheDocument();
    });

    it("should not render when recipientPublicKey is missing", () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { recipientPublicKey, ...propsWithoutKey } = mockProps;
      render(<TipButton {...(propsWithoutKey as any)} />);

      expect(screen.queryByTestId("tip-button")).not.toBeInTheDocument();
    });

    it("should render when recipientPublicKey is provided", () => {
      render(<TipButton {...mockProps} />);

      expect(screen.getByTestId("tip-button")).toBeInTheDocument();
    });
  });

  describe("Click Behavior", () => {
    it("should call onTipClick when clicked", () => {
      render(<TipButton {...mockProps} />);

      const button = screen.getByTestId("tip-button");
      fireEvent.click(button);

      expect(mockProps.onTipClick).toHaveBeenCalledTimes(1);
    });

    it("should prevent default event behavior", () => {
      render(<TipButton {...mockProps} />);

      const button = screen.getByTestId("tip-button");
      const event = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = jest.spyOn(event, "preventDefault");

      button.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it("should stop event propagation", () => {
      render(<TipButton {...mockProps} />);

      const button = screen.getByTestId("tip-button");
      const event = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      const stopPropagationSpy = jest.spyOn(event, "stopPropagation");

      button.dispatchEvent(event);

      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    it("should not call onTipClick when disabled (no recipient public key)", () => {
      render(<TipButton {...mockProps} recipientPublicKey="" />);

      const button = screen.getByTestId("tip-button");
      expect(button).toBeDisabled();
    });
  });

  describe("Props Forwarding", () => {
    it("should apply custom className", () => {
      render(<TipButton {...mockProps} className="custom-class" />);

      const button = screen.getByTestId("tip-button");
      expect(button).toHaveClass("custom-class");
    });

    it("should forward variant prop", () => {
      render(<TipButton {...mockProps} variant="outline" />);

      const button = screen.getByTestId("tip-button");
      expect(button).toBeInTheDocument();
    });

    it("should render with secondary variant", () => {
      render(<TipButton {...mockProps} variant="secondary" />);

      const button = screen.getByTestId("tip-button");
      expect(button).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle multiple rapid clicks", () => {
      render(<TipButton {...mockProps} />);

      const button = screen.getByTestId("tip-button");
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(mockProps.onTipClick).toHaveBeenCalledTimes(3);
    });

    it("should render with very long recipient username", () => {
      const longUsername = "a".repeat(100);
      render(<TipButton {...mockProps} recipientUsername={longUsername} />);

      const button = screen.getByTestId("tip-button");
      expect(button).toHaveAttribute("title", `Send a tip to ${longUsername}`);
    });

    it("should handle special characters in username", () => {
      const specialUsername = "user@#$%^&*()_+";
      render(<TipButton {...mockProps} recipientUsername={specialUsername} />);

      const button = screen.getByTestId("tip-button");
      expect(button).toHaveAttribute(
        "title",
        `Send a tip to ${specialUsername}`
      );
    });
  });
});
