"use client";

import type React from "react";

import { useState, useRef, useEffect } from "react";
import { ChevronRight, Send, Smile, GiftIcon } from "lucide-react";
import {
  bgClasses,
  borderClasses,
  combineClasses,
  textClasses,
} from "@/lib/theme-classes";
import { text } from "stream/consumers";

interface ChatMessage {
  id: number;
  username: string;
  message: string;
  color: string;
}

interface ChatSectionProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isCollapsible?: boolean;
  isFullscreen?: boolean;
  className?: string;
  onToggleChat?: () => void;
  showChat?: boolean;
}

const ChatSection = ({
  messages,
  onSendMessage,
  isCollapsible = true,
  isFullscreen = false,
  className = "",
  onToggleChat,
  showChat = true,
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
    if (!chatMessage.trim()) return;

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

  if (!showChat) return null;

  return (
    <div
      className={combineClasses(
        bgClasses.primary,
        `flex flex-col ${className}`
      )}
    >
      {/* Chat header */}
      <div
        className={combineClasses(
          borderClasses.primary,
          "p-3 border-b flex justify-between items-center"
        )}
      >
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
      <div
        className={combineClasses(
          textClasses.primary,
          bgClasses.primary,
          "relative flex-1 overflow-hidden"
        )}
      >
        {/* Gradient overlay at top */}
        <div
          className={`absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-white ${
            isFullscreen ? "dark:from-black " : "dark:from-[#17191A]"
          } to-transparent z-10`}
        />

        <div
          ref={chatContainerRef}
          className={`${isFullscreen ? "h-full" : "h-[calc(100vh-200px)]"} overflow-y-auto scrollbar-hide p-3 space-y-4 pt-8 pb-16`}
        >
          {messages.map((message) => (
            <div key={message.id} className="text-xs xl:text-sm flex">
              <div
                className="w-1 mr-2 rounded-full"
                style={{ backgroundColor: message.color }}
              />
              <div>
                <span className="font-medium" style={{ color: message.color }}>
                  {message.username}:{" "}
                </span>
                <span className="">{message.message}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Gradient overlay at bottom */}
        <div
          className={`absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white ${
            isFullscreen ? "dark:from-black" : "dark:from-[#17191A]"
          } to-transparent z-10`}
        />
      </div>

      {/* Chat input */}
      <div
        className={combineClasses(
          borderClasses.primary,
          "p-3 border-t"
        )}
      >
        <div className="relative flex items-center">
          <input
            type="text"
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message"
            className={combineClasses(
              bgClasses.secondary,
              textClasses.primary,
              "w-full bg-[#2D2F31] text- rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
            )}
          />
          <div className="absolute right-2 top-2 flex space-x-1 items-center">
            <button className="text-gray-400 dark:hover:text-white">
              <Smile className="h-4 w-4" />
            </button>
            <button className="text-gray-400 dark:hover:text-white">
              <GiftIcon className="h-4 w-4" />
            </button>
            <button
              className="text-gray-400 dark:hover:text-white"
              onClick={handleSendMessage}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatSection;
