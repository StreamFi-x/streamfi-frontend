"use client";

import type React from "react";

import { useState, useRef, useEffect } from "react";
import { ChevronRight, Send, Smile, GiftIcon, LogIn } from "lucide-react";
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
  onLoginClick?: () => void;
}

// ── Emoji data ───────────────────────────────────────────────────────────────
const EMOJI_CATEGORIES: Record<string, string[]> = {
  "😊": [
    "😀",
    "😂",
    "🤣",
    "😍",
    "🥰",
    "😘",
    "🤩",
    "😎",
    "😅",
    "😆",
    "🥲",
    "😊",
    "🙂",
    "🤔",
    "😏",
    "😒",
    "😔",
    "😢",
    "😭",
    "😤",
    "😡",
    "🤯",
    "😳",
    "😱",
    "🤗",
    "😴",
    "🥱",
    "😵",
    "🤧",
    "😷",
  ],
  "👋": [
    "👍",
    "👎",
    "👏",
    "🙌",
    "🤝",
    "🫶",
    "✌️",
    "🤙",
    "👋",
    "💪",
    "🙏",
    "👌",
    "🤌",
    "🤞",
    "🫡",
    "🤘",
    "✋",
    "🤚",
    "🖐️",
    "🖖",
  ],
  "❤️": [
    "❤️",
    "🧡",
    "💛",
    "💚",
    "💙",
    "💜",
    "🖤",
    "🤍",
    "💔",
    "❣️",
    "💕",
    "💞",
    "💓",
    "💗",
    "💖",
    "💝",
    "💘",
    "🩷",
    "🩵",
    "🩶",
  ],
  "🔥": [
    "🔥",
    "⭐",
    "🌟",
    "💫",
    "✨",
    "⚡",
    "🎯",
    "🏆",
    "🎮",
    "💯",
    "🎉",
    "🎊",
    "🎁",
    "🎶",
    "🎵",
    "🚀",
    "💎",
    "👑",
    "🌈",
    "💥",
  ],
};

const CATEGORY_LABELS: Record<string, string> = {
  "😊": "Faces",
  "👋": "Gestures",
  "❤️": "Hearts",
  "🔥": "Misc",
};

// ── Component ────────────────────────────────────────────────────────────────
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
  onLoginClick,
}: ChatSectionProps) => {
  const [chatMessage, setChatMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeCategory, setActiveCategory] = useState("😊");

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Close emoji picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSendMessage = () => {
    if (!chatMessage.trim() || !isWalletConnected || isSending) {
      return;
    }
    onSendMessage(chatMessage);
    setChatMessage("");
    setShowEmojiPicker(false);
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

  const handleEmojiClick = (emoji: string) => {
    setChatMessage(prev => prev + emoji);
  };

  if (!showChat) {
    return null;
  }

  return (
    <div className={`bg-background flex flex-col ${className}`}>
      {/* Chat header */}
      <div className="border border-border p-3 border-b flex justify-between items-center flex-shrink-0">
        <h3 className="font-medium">Chat</h3>
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

      {/* Chat messages — absolute inset-0 fills exactly the space between header and input */}
      <div className="text-foreground bg-background relative flex-1 min-h-0">
        {/* Gradient overlay at top */}
        <div
          className={`absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-white ${
            isFullscreen ? "dark:from-secondary" : "dark:from-background"
          } to-transparent z-10 pointer-events-none`}
        />

        <div
          ref={chatContainerRef}
          className="absolute inset-0 overflow-y-auto scrollbar-hide p-3 space-y-4 pt-8 pb-4"
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
                  className="w-1 mr-2 rounded-full shrink-0"
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
          } to-transparent z-10 pointer-events-none`}
        />
      </div>

      {/* Chat input — always pinned at bottom */}
      <div className="border border-border p-3 border-t flex-shrink-0 relative">
        {/* Emoji picker */}
        {showEmojiPicker && isWalletConnected && (
          <div
            ref={emojiPickerRef}
            className="absolute bottom-full left-0 right-0 mb-1 mx-3 bg-background border border-border rounded-lg shadow-xl z-20 overflow-hidden"
          >
            {/* Category tabs */}
            <div className="flex border-b border-border">
              {Object.keys(EMOJI_CATEGORIES).map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  title={CATEGORY_LABELS[cat]}
                  className={`flex-1 py-1.5 text-sm transition-colors ${
                    activeCategory === cat
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            {/* Emoji grid */}
            <div className="grid grid-cols-8 gap-0.5 p-2">
              {EMOJI_CATEGORIES[activeCategory].map(emoji => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiClick(emoji)}
                  className="text-lg p-1 rounded hover:bg-accent transition-colors leading-none"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {isWalletConnected ? (
          <div className="relative flex items-center">
            <input
              type="text"
              value={chatMessage}
              onChange={e => setChatMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message"
              disabled={isSending}
              className="w-full bg-secondary text-foreground rounded-md px-3 py-2 pr-20 text-sm focus:outline-none focus:ring-1 focus:ring-highlight disabled:opacity-50"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex space-x-1 items-center">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(p => !p)}
                className={`transition-colors ${
                  showEmojiPicker
                    ? "text-highlight"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label="Toggle emoji picker"
              >
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
          <button
            onClick={onLoginClick}
            className="flex items-center justify-center gap-2 text-sm text-highlight hover:text-highlight/80 transition-colors py-1 w-full"
          >
            <LogIn className="h-4 w-4" />
            <span>Log in or sign up to chat</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatSection;
