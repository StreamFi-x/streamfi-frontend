"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, X, Send, MessageCircle } from "lucide-react";
import { useAccount } from "@starknet-react/core";
import MuxPlayer from "@mux/mux-player-react";
import { useStreamData } from "@/hooks/useStreamData";
import { useChat } from "@/hooks/useChat";

export default function StreamPreview() {
  const { address } = useAccount();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChatOverlay, setShowChatOverlay] = useState(true);
  const [chatMessage, setChatMessage] = useState("");
  const [fullscreenElement, setFullscreenElement] = useState<Element | null>(
    null
  );
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);

  // Use optimized SWR hook for data fetching with caching
  const { streamData, isLoading } = useStreamData(address);
  const { messages, sendMessage, isSending } = useChat(
    streamData?.playbackId,
    address,
    streamData?.isLive ?? false
  );

  // Stable refs so the native keydown listener always reads current values
  const chatMessageRef = useRef(chatMessage);
  chatMessageRef.current = chatMessage;
  const isSendingRef = useRef(isSending);
  isSendingRef.current = isSending;

  // Detect Mux Player fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fsElement = document.fullscreenElement;
      const isInFullscreen = !!fsElement;
      setIsFullscreen(isInFullscreen);
      setFullscreenElement(fsElement);
      if (isInFullscreen) {
        setShowChatOverlay(true);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("msfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "msfullscreenchange",
        handleFullscreenChange
      );
    };
  }, []);

  // Auto-scroll chat overlay when new messages arrive
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Native keydown listener: stops the event from reaching Mux Player's native
  // keyboard handler (which calls preventDefault on space for play/pause).
  // React's synthetic onKeyDown runs too late — the native event has already
  // traveled the DOM tree by then. We also handle Enter here since stopPropagation
  // prevents the React synthetic handler from firing.
  useEffect(() => {
    const input = overlayInputRef.current;
    if (!input) {
      return;
    }

    const handler = (e: KeyboardEvent) => {
      e.stopPropagation(); // block Mux Player's bubble-phase listener
      if (
        e.key === "Enter" &&
        !isSendingRef.current &&
        chatMessageRef.current.trim()
      ) {
        sendMessage(chatMessageRef.current);
        setChatMessage("");
      }
    };

    input.addEventListener("keydown", handler);
    return () => input.removeEventListener("keydown", handler);
  }, [isFullscreen, showChatOverlay, sendMessage]);

  const handleSendMessage = () => {
    if (!chatMessage.trim() || isSending) {
      return;
    }
    sendMessage(chatMessage);
    setChatMessage("");
  };

  // Render chat overlay component
  const renderChatOverlay = () => {
    if (!isFullscreen || !showChatOverlay) {
      return null;
    }

    return (
      <motion.div
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 400, opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="absolute right-4 top-4 bottom-20 w-80 md:w-96 flex flex-col pointer-events-auto z-[100]"
        style={{ maxHeight: "calc(100vh - 8rem)" }}
      >
        {/* Transparent Chat Container */}
        <div className="flex flex-col h-full bg-gradient-to-b from-black/40 via-black/30 to-black/40 backdrop-blur-sm rounded-lg overflow-hidden">
          {/* Chat Header */}
          <div className="flex items-center justify-between p-3 bg-black/50 backdrop-blur-md border-b border-white/10">
            <div className="flex items-center gap-2">
              <MessageCircle size={16} className="text-white" />
              <span className="text-white font-semibold text-sm">
                Live Chat
              </span>
            </div>
            <button
              onClick={() => setShowChatOverlay(false)}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              title="Hide chat"
            >
              <X size={16} className="text-white" />
            </button>
          </div>

          {/* Chat Messages - Scrollable */}
          <div
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
          >
            <div className="text-xs text-white/60 text-center py-2">
              Welcome to live chat!
            </div>
            <div className="flex flex-col gap-2">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`bg-black/30 backdrop-blur-sm rounded-lg p-2 ${msg.isPending ? "opacity-50" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs text-white font-semibold"
                      style={{ backgroundColor: msg.color }}
                    >
                      {msg.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span
                          className="text-xs font-semibold"
                          style={{ color: msg.color }}
                        >
                          {msg.username}
                        </span>
                      </div>
                      <p className="text-white text-sm break-words">
                        {msg.message}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat Input */}
          <div className="p-3 bg-black/50 backdrop-blur-md border-t border-white/10">
            <div className="flex items-center gap-2">
              <input
                ref={overlayInputRef}
                type="text"
                value={chatMessage}
                onChange={e => setChatMessage(e.target.value)}
                placeholder="Say something..."
                disabled={isSending}
                className="flex-1 bg-white/10 text-white text-sm px-3 py-2 rounded-lg border border-white/20 focus:border-purple-500 focus:bg-white/15 focus:outline-none placeholder-white/50 disabled:opacity-50"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <button
                onClick={handleSendMessage}
                disabled={!chatMessage.trim() || isSending}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // Render chat toggle button
  const renderChatToggle = () => {
    if (!isFullscreen || showChatOverlay) {
      return null;
    }

    return (
      <motion.button
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 100, opacity: 0 }}
        onClick={() => setShowChatOverlay(true)}
        className="absolute right-4 top-20 bg-black/70 backdrop-blur-md text-white px-4 py-2 rounded-lg border border-white/20 hover:bg-black/80 transition-all z-[100] flex items-center gap-2"
        title="Show chat"
      >
        <MessageCircle size={16} />
        <span className="text-sm font-semibold">Chat</span>
      </motion.button>
    );
  };

  return (
    <motion.div
      className="h-full flex flex-col rounded-md w-full max-w-xl overflow-hidden relative"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="bg-card p-2 flex justify-between items-center border-b border-border">
        <div className="flex items-center">
          <MonitorIcon size={18} className="mr-2 text-foreground" />
          <span className="text-foreground">Stream Preview</span>
        </div>
        <div className="flex space-x-2">
          <button className="p-1 hover:bg-surface-hover rounded-md transition-colors">
            <Settings size={18} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      <div
        className="flex-1 max-w-xl w-full bg-black relative"
        id="video-container"
      >
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white text-center">
              <div className="text-lg">Loading stream...</div>
            </div>
          </div>
        ) : streamData?.playbackId ? (
          <>
            <MuxPlayer
              playbackId={streamData.playbackId}
              streamType="ll-live:dvr"
              autoPlay="muted"
              metadata={{
                video_id: streamData.playbackId,
                video_title: "Live Stream",
                viewer_user_id: address || "anonymous",
              }}
              primaryColor="#ac39f2"
              secondaryColor="#000000"
              maxResolution="1080p"
              minResolution="480p"
              preload="auto"
              className="w-full h-full"
            />
            <div className="absolute top-4 left-4 z-10 pointer-events-none">
              {streamData.isLive ? (
                <div className="bg-red-600 px-3 py-1 text-xs font-semibold rounded text-white flex items-center gap-2">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                  LIVE
                </div>
              ) : (
                <div className="bg-gray-600 px-3 py-1 text-xs font-semibold rounded text-white">
                  OFFLINE
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src="/Images/stream-preview.png"
              alt="Stream preview"
              className="object-cover"
            />
            <div className="absolute top-4 left-4 bg-gray-600 px-3 py-1 text-xs font-semibold rounded text-white">
              NO STREAM
            </div>
          </div>
        )}
      </div>

      {/* Portal chat overlay into fullscreen element */}
      {isFullscreen && fullscreenElement && (
        <>
          {createPortal(
            <AnimatePresence>
              {renderChatOverlay()}
              {renderChatToggle()}
            </AnimatePresence>,
            fullscreenElement
          )}
        </>
      )}
    </motion.div>
  );
}

function MonitorIcon({ size = 24, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}
