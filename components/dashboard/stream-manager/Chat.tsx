"use client";

import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { MessageSquare, X, Send, Smile } from "lucide-react";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import { useStreamData } from "@/hooks/useStreamData";
import { useChat } from "@/hooks/useChat";

export default function Chat() {
  const { publicKey: address } = useStellarWallet();
  const { streamData } = useStreamData(address || undefined);
  const { messages, sendMessage, isSending, isLoading } = useChat(
    streamData?.playbackId,
    address || undefined,
    streamData?.isLive ?? false
  );

  const [newMessage, setNewMessage] = React.useState("");
  const [isMinimized, setIsMinimized] = React.useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      100;

    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) {
      return;
    }

    sendMessage(newMessage);
    setNewMessage("");
  };

  const isEmpty = messages.length === 0;

  if (isMinimized) {
    return (
      <div className="p-2 border-b border-border">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageSquare size={18} />
          <span>Show Chat</span>
        </button>
      </div>
    );
  }

  return (
    <motion.div
      className="flex flex-col h-full rounded-md overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="bg-card p-2 flex justify-between items-center border-b border-border">
        <div className="flex items-center">
          <MessageSquare size={18} className="mr-2 text-foreground" />
          <span className="text-foreground">Chat</span>
        </div>
        <div className="flex space-x-2">
          <button
            className="p-1 hover:bg-surface-hover rounded-md transition-colors"
            onClick={() => setIsMinimized(true)}
          >
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>
      </div>
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto scrollbar-hide bg-background p-0 relative"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-center p-4">
            <p className="text-sm text-muted-foreground">Loading chat...</p>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <p className="text-sm font-semibold mb-2 text-foreground">
              Your chat room is quiet... for now
            </p>
            <p className="text-xs text-muted-foreground">
              Start the convo! Viewers will be able to chat with you in
              real-time once they join.
            </p>
          </div>
        ) : (
          <div className="p-2 pt-8 pb-16">
            {messages.map(message => (
              <div
                key={message.id}
                className={`mb-2 flex ${message.isPending ? "opacity-50" : ""}`}
              >
                <div
                  className="w-1 mr-2 rounded-full"
                  style={{ backgroundColor: message.color }}
                ></div>

                <div className="flex-1">
                  <div className="flex">
                    <span
                      className="font-medium"
                      style={{ color: message.color }}
                    >
                      {message.username}
                    </span>
                  </div>
                  <div className="text-xs text-foreground">
                    {message.message}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <form
        onSubmit={handleSendMessage}
        className="p-2 bg-background border-border border-t flex items-center space-x-2"
      >
        <input
          type="text"
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder="Send a message"
          disabled={isSending}
          className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-highlight focus:outline-none text-foreground disabled:opacity-50"
        />
        <button
          type="button"
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Smile size={20} />
        </button>
        <button
          type="submit"
          className="p-2 bg-highlight hover:bg-highlight/80 text-primary-foreground rounded-md transition-colors disabled:opacity-50"
          disabled={!newMessage.trim() || isSending}
        >
          <Send size={20} />
        </button>
      </form>
    </motion.div>
  );
}

