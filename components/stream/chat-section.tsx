"use client";

import type React from "react";

import { useState, useRef, useEffect } from "react";
import { ChevronRight, Send, Smile, GiftIcon, Wallet } from "lucide-react";
import type { ChatMessage } from "@/types/chat";

interface ChatSectionProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isCollapsible?: boolean;
  isFullscreen?: boolean;
  className?: string;
  onToggleChat?: () => void;
  showChat?: boolean;
  isWalletConnected?: boolean;
  isSending?: boolean;
}

const ChatSection = ({
  messages,
  onSendMessage,
  isCollapsible = true,
  isFullscreen = false,
  className = "",
  onToggleChat,
  showChat = true,
  isWalletConnected = false,
  isSending = false,
}: ChatSectionProps) => {
  const [chatMessage, setChatMessage] = useState("");
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!chatMessage.trim() || !isWalletConnected || isSending) {
      return;
    }

    onSendMessage(chatMessage);
    setChatMessage("");

    // Auto-scroll to bottom
    if (chatContainerRef.current) {
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop =
            chatContainerRef.current.scrollHeight;
        }
      }, 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  if (!showChat) {
    return null;
  }

  return (
    <div className={`bg-background flex flex-col ${className}`}>
      {/* Chat header */}
      <div className="border border-border p-3 border-b flex justify-between items-center">
        <h3 className="text- font-medium">Chat</h3>
        {isCollapsible && onToggleChat && (
          <button
            onClick={onToggleChat}
            className="transition-colors"
            aria-label="Hide chat"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Chat messages */}
      <div className="text-foreground bg-background relative flex-1 overflow-hidden">
        {/* Gradient overlay at top */}
        <div
          className={`absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-white ${
            isFullscreen ? "dark:from-secondary " : "dark:from-background"
          } to-transparent z-10`}
        />

        <div
          ref={chatContainerRef}
          className={`${isFullscreen ? "h-full" : "h-[calc(100vh-200px)]"} overflow-y-auto scrollbar-hide p-3 space-y-4 pt-8 pb-16`}
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <p className="text-sm font-semibold mb-2 text-foreground">
                Chat is quiet... for now
              </p>
              <p className="text-xs text-muted-foreground">
                Messages will appear here when viewers start chatting.
              </p>
            </div>
          ) : (
            messages.map(message => (
              <div
                key={message.id}
                className={`text-xs xl:text-sm flex ${message.isPending ? "opacity-50" : ""}`}
              >
                <div
                  className="w-1 mr-2 rounded-full"
                  style={{ backgroundColor: message.color }}
                />
                <div>
                  <span
                    className="font-medium"
                    style={{ color: message.color }}
                  >
                    {message.username}:{" "}
                  </span>
                  <span>{message.message}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Gradient overlay at bottom */}
        <div
          className={`absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white ${
            isFullscreen ? "dark:from-secondary" : "dark:from-background"
          } to-transparent z-10`}
        />
      </div>

      {/* Chat input */}
      <div className="border border-border p-3 border-t">
        {isWalletConnected ? (
          <div className="relative flex items-center">
            <input
              type="text"
              value={chatMessage}
              onChange={e => setChatMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message"
              disabled={isSending}
              className="w-full bg-secondary text-foreground rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-highlight disabled:opacity-50"
            />
            <div className="absolute right-2 top-2 flex space-x-1 items-center">
              <button className="text-muted-foreground hover:text-foreground">
                <Smile className="h-4 w-4" />
              </button>
              <button className="text-muted-foreground hover:text-foreground">
                <GiftIcon className="h-4 w-4" />
              </button>
              <button
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                onClick={handleSendMessage}
                disabled={!chatMessage.trim() || isSending}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-1">
            <Wallet className="h-4 w-4" />
            <span>Connect wallet to chat</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatSection;
