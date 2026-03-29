"use client";

import type React from "react";

import { useState, useRef, useEffect } from "react";
import {
  ChevronRight,
  Send,
  Smile,
  GiftIcon,
  Wallet,
  MoreVertical,
  Trash2,
  Ban,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import type { ChatMessage } from "@/types/chat";
import { QuickTipBar } from "./QuickTipBar";

interface ChatSectionProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  playbackId?: string | null;
  streamerUsername?: string;
  streamerPublicKey?: string | null;
  viewerPublicKey?: string | null;
  onOpenCustomTip?: () => void;
  onDeleteMessage?: (messageId: number) => void;
  onBanUser?: (username: string, durationMinutes?: number) => void;
  isCollapsible?: boolean;
  isFullscreen?: boolean;
  className?: string;
  onToggleChat?: () => void;
  showChat?: boolean;
  isWalletConnected?: boolean;
  isSending?: boolean;
  isStreamOwner?: boolean;
}

const ChatSection = ({
  messages,
  onSendMessage,
  playbackId = null,
  streamerUsername,
  streamerPublicKey = null,
  viewerPublicKey = null,
  onOpenCustomTip,
  onDeleteMessage,
  onBanUser,
  isCollapsible = true,
  isFullscreen = false,
  className = "",
  onToggleChat,
  showChat = true,
  isWalletConnected = false,
  isSending = false,
  isStreamOwner = false,
}: ChatSectionProps) => {
  const [chatMessage, setChatMessage] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    messageId: number;
    username: string;
    x: number;
    y: number;
    showTimeoutSubmenu?: boolean;
  } | null>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.messageType !== "system") {
      return;
    }
    setHighlightId(last.id);
    const t = window.setTimeout(() => setHighlightId(null), 3000);
    return () => window.clearTimeout(t);
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [contextMenu]);

  const handleContextMenu = (
    e: React.MouseEvent,
    messageId: number,
    username: string
  ) => {
    if (!isStreamOwner) {
      return;
    }
    e.preventDefault();
    setContextMenu({
      messageId,
      username,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleDeleteMessage = () => {
    if (contextMenu && onDeleteMessage) {
      onDeleteMessage(contextMenu.messageId);
      setContextMenu(null);
    }
  };

  const handleBanUser = (durationMinutes?: number) => {
    if (contextMenu && onBanUser) {
      onBanUser(contextMenu.username, durationMinutes);
      setContextMenu(null);
    } else if (contextMenu) {
      toast.message("User timeouts and bans are not wired up yet.");
      setContextMenu(null);
    }
  };

  const handleSendMessage = () => {
    if (!chatMessage.trim() || !isWalletConnected || isSending) {
      return;
    }

    onSendMessage(chatMessage);
    setChatMessage("");

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

      <div className="text-foreground bg-background relative flex-1 overflow-hidden">
        <div
          className={`absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-white ${
            isFullscreen ? "dark:from-secondary " : "dark:from-background"
          } to-transparent z-10`}
        />

        <div
          ref={chatContainerRef}
          className={`${isFullscreen ? "h-full" : "h-[calc(100vh-200px)]"} overflow-y-auto scrollbar-hide p-3 space-y-4 pt-8 pb-16`}
        >
          {typeof highlightId === "number" && (
            <div className="sticky top-2 z-20">
              {(() => {
                const msg = messages.find(m => m.id === highlightId);
                if (!msg) {
                  return null;
                }
                return (
                  <div className="bg-highlight/15 border border-highlight/30 text-highlight rounded-md px-3 py-2 text-xs">
                    {msg.message}
                  </div>
                );
              })()}
            </div>
          )}
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
                className={`text-xs xl:text-sm flex group relative ${
                  message.isPending ? "opacity-50" : ""
                } ${message.messageType === "system" ? "text-highlight" : ""}`}
                onContextMenu={e =>
                  handleContextMenu(e, message.id, message.username)
                }
              >
                <div
                  className="w-1 mr-2 rounded-full shrink-0"
                  style={{ backgroundColor: message.color }}
                />
                <div className="flex-1 min-w-0">
                  <span
                    className="font-medium"
                    style={{ color: message.color }}
                  >
                    {message.messageType === "system"
                      ? "System: "
                      : `${message.username}: `}
                  </span>
                  <span>{message.message}</span>
                </div>
                {isStreamOwner && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setContextMenu({
                        messageId: message.id,
                        username: message.username,
                        x: e.currentTarget.getBoundingClientRect().right,
                        y: e.currentTarget.getBoundingClientRect().top,
                      });
                    }}
                    className="opacity-0 group-hover:opacity-100 ml-2 p-1 hover:bg-secondary rounded transition-opacity shrink-0"
                  >
                    <MoreVertical className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <div
          className={`absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white ${
            isFullscreen ? "dark:from-secondary" : "dark:from-background"
          } to-transparent z-10`}
        />
      </div>

      <div className="border border-border p-3 border-t">
        {isWalletConnected ? (
          <div>
            {playbackId &&
              streamerUsername &&
              streamerPublicKey &&
              viewerPublicKey && (
                <QuickTipBar
                  playbackId={playbackId}
                  streamerUsername={streamerUsername}
                  streamerPublicKey={streamerPublicKey}
                  viewerPublicKey={viewerPublicKey}
                  hidden={
                    isInputFocused && typeof window !== "undefined"
                      ? window.innerWidth < 640
                      : false
                  }
                  onCustomTip={onOpenCustomTip}
                />
              )}
            <div className="relative flex items-center">
              <input
                type="text"
                value={chatMessage}
                onChange={e => setChatMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                placeholder="Send a message"
                disabled={isSending}
                className="w-full bg-secondary text-foreground rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-highlight disabled:opacity-50"
              />
              <div className="absolute right-2 top-2 flex space-x-1 items-center">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Smile className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <GiftIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                  onClick={handleSendMessage}
                  disabled={!chatMessage.trim() || isSending}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-1">
            <Wallet className="h-4 w-4" />
            <span>Connect wallet to chat</span>
          </div>
        )}
      </div>

      {contextMenu && isStreamOwner && (
        <div
          className="fixed bg-background border border-border rounded-md shadow-lg z-50 py-1 min-w-[160px]"
          style={{
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
          }}
          onClick={e => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleDeleteMessage}
            className="w-full px-3 py-2 text-left text-sm hover:bg-secondary flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete message
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setContextMenu(prev =>
                  prev
                    ? { ...prev, showTimeoutSubmenu: !prev.showTimeoutSubmenu }
                    : null
                )
              }
              className="w-full px-3 py-2 text-left text-sm hover:bg-secondary flex items-center gap-2 justify-between"
            >
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Timeout
              </div>
              <ChevronRight className="h-3 w-3" />
            </button>
            {contextMenu.showTimeoutSubmenu && (
              <div className="absolute left-full top-0 ml-1 bg-background border border-border rounded-md shadow-lg py-1 min-w-[120px]">
                <button
                  type="button"
                  onClick={() => handleBanUser(1)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-secondary"
                >
                  1 minute
                </button>
                <button
                  type="button"
                  onClick={() => handleBanUser(5)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-secondary"
                >
                  5 minutes
                </button>
                <button
                  type="button"
                  onClick={() => handleBanUser(10)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-secondary"
                >
                  10 minutes
                </button>
                <button
                  type="button"
                  onClick={() => handleBanUser(60)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-secondary"
                >
                  1 hour
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => handleBanUser()}
            className="w-full px-3 py-2 text-left text-sm hover:bg-secondary flex items-center gap-2 text-red-500"
          >
            <Ban className="h-4 w-4" />
            Ban user
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatSection;
