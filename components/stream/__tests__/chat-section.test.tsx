import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatSection from "../chat-section";
import type { ChatMessage } from "@/types/chat";

const makeMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 1,
  username: "Alice",
  message: "Hello there",
  color: "#9333ea",
  messageType: "message",
  createdAt: new Date().toISOString(),
  ...overrides,
});

const defaultProps = {
  messages: [],
  onSendMessage: jest.fn(),
  isWalletConnected: true,
};

describe("ChatSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders the chat header", () => {
      render(<ChatSection {...defaultProps} />);
      expect(screen.getByText("Chat")).toBeInTheDocument();
    });

    it("shows empty state when no messages", () => {
      render(<ChatSection {...defaultProps} messages={[]} />);
      expect(screen.getByText("Chat is quiet... for now")).toBeInTheDocument();
    });

    it("renders messages from props", () => {
      const messages = [
        makeMessage({ id: 1, username: "Alice", message: "Hello" }),
        makeMessage({ id: 2, username: "Bob", message: "Hey there" }),
      ];

      render(<ChatSection {...defaultProps} messages={messages} />);

      expect(screen.getByText(/Alice/)).toBeInTheDocument();
      expect(screen.getByText("Hello")).toBeInTheDocument();
      expect(screen.getByText(/Bob/)).toBeInTheDocument();
      expect(screen.getByText("Hey there")).toBeInTheDocument();
    });

    it("renders pending messages with reduced opacity class", () => {
      const messages = [makeMessage({ id: 1, isPending: true })];
      const { container } = render(
        <ChatSection {...defaultProps} messages={messages} />
      );
      const messageEl = container.querySelector(".opacity-50");
      expect(messageEl).toBeInTheDocument();
    });

    it("renders normal messages without opacity-50 class", () => {
      const messages = [makeMessage({ id: 1, isPending: false })];
      const { container } = render(
        <ChatSection {...defaultProps} messages={messages} />
      );
      const messageEl = container.querySelector(".opacity-50");
      expect(messageEl).toBeNull();
    });

    it("returns null when showChat is false", () => {
      const { container } = render(
        <ChatSection {...defaultProps} showChat={false} />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe("wallet auth gating", () => {
    it("shows input when wallet is connected", () => {
      render(<ChatSection {...defaultProps} isWalletConnected={true} />);
      expect(screen.getByPlaceholderText("Send a message")).toBeInTheDocument();
    });

    it("shows 'Connect wallet to chat' when wallet is not connected", () => {
      render(<ChatSection {...defaultProps} isWalletConnected={false} />);
      expect(screen.getByText("Connect wallet to chat")).toBeInTheDocument();
      expect(
        screen.queryByPlaceholderText("Send a message")
      ).not.toBeInTheDocument();
    });
  });

  describe("sending messages", () => {
    it("calls onSendMessage with trimmed message when Send button clicked", async () => {
      const onSendMessage = jest.fn();
      const user = userEvent.setup();

      render(
        <ChatSection
          {...defaultProps}
          onSendMessage={onSendMessage}
          isWalletConnected={true}
        />
      );

      const input = screen.getByPlaceholderText("Send a message");
      await user.type(input, "hello world");

      const sendButton = screen
        .getAllByRole("button")
        .find(btn => btn.querySelector("[data-testid='icon-Send']"));
      await user.click(sendButton!);

      expect(onSendMessage).toHaveBeenCalledWith("hello world");
    });

    it("calls onSendMessage on Enter key press", async () => {
      const onSendMessage = jest.fn();
      const user = userEvent.setup();

      render(
        <ChatSection
          {...defaultProps}
          onSendMessage={onSendMessage}
          isWalletConnected={true}
        />
      );

      const input = screen.getByPlaceholderText("Send a message");
      await user.type(input, "hello{Enter}");

      expect(onSendMessage).toHaveBeenCalledWith("hello");
    });

    it("clears input after sending", async () => {
      const user = userEvent.setup();

      render(<ChatSection {...defaultProps} isWalletConnected={true} />);

      const input = screen.getByPlaceholderText("Send a message");
      await user.type(input, "hello{Enter}");

      expect(input).toHaveValue("");
    });

    it("does not call onSendMessage when message is empty", async () => {
      const onSendMessage = jest.fn();
      const user = userEvent.setup();

      render(
        <ChatSection
          {...defaultProps}
          onSendMessage={onSendMessage}
          isWalletConnected={true}
        />
      );

      const input = screen.getByPlaceholderText("Send a message");
      await user.type(input, "{Enter}");

      expect(onSendMessage).not.toHaveBeenCalled();
    });

    it("does not call onSendMessage when isSending is true", async () => {
      const onSendMessage = jest.fn();

      render(
        <ChatSection
          {...defaultProps}
          onSendMessage={onSendMessage}
          isWalletConnected={true}
          isSending={true}
        />
      );

      const input = screen.getByPlaceholderText("Send a message");
      // Input is disabled when isSending
      expect(input).toBeDisabled();
    });

    it("does not call onSendMessage when wallet is not connected", async () => {
      const onSendMessage = jest.fn();

      render(
        <ChatSection
          {...defaultProps}
          onSendMessage={onSendMessage}
          isWalletConnected={false}
        />
      );

      // No input rendered, so no way to type
      expect(
        screen.queryByPlaceholderText("Send a message")
      ).not.toBeInTheDocument();
      expect(onSendMessage).not.toHaveBeenCalled();
    });
  });

  describe("collapsible behaviour", () => {
    it("shows toggle button when isCollapsible and onToggleChat provided", () => {
      const onToggleChat = jest.fn();
      render(
        <ChatSection
          {...defaultProps}
          isCollapsible={true}
          onToggleChat={onToggleChat}
        />
      );

      expect(
        screen.getByRole("button", { name: "Hide chat" })
      ).toBeInTheDocument();
    });

    it("calls onToggleChat when toggle button clicked", async () => {
      const onToggleChat = jest.fn();
      const user = userEvent.setup();

      render(
        <ChatSection
          {...defaultProps}
          isCollapsible={true}
          onToggleChat={onToggleChat}
        />
      );

      await user.click(screen.getByRole("button", { name: "Hide chat" }));
      expect(onToggleChat).toHaveBeenCalledTimes(1);
    });

    it("does not show toggle button when isCollapsible is false", () => {
      render(
        <ChatSection
          {...defaultProps}
          isCollapsible={false}
          onToggleChat={jest.fn()}
        />
      );

      expect(
        screen.queryByRole("button", { name: "Hide chat" })
      ).not.toBeInTheDocument();
    });
  });
});
