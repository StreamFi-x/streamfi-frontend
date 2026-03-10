/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import type React from "react";
import {
  ChevronRight,
  Edit3,
  Gift,
  Instagram,
  MessageCircle,
  Send,
  Share2,
  X,
  Twitter,
  Users,
  Menu,
  Flag,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { JSX, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
  </svg>
);
const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);
import StreamInfoModal from "../dashboard/common/StreamInfoModal";
import DashboardScreenGuard from "../explore/DashboardScreenGuard";
import { Button } from "../ui/button";
import ChatSection from "./chat-section";
import { ViewStreamSkeleton } from "../skeletons/ViewStreamSkeleton";
import MuxPlayer from "@/components/MuxPlayerLazy";
import ReportLiveStreamModal from "../modals/ReportLiveStreamModal";
import { useChat } from "@/hooks/useChat";
import { TipButton, TipModalContainer } from "@/components/tipping";
import { useTipModal } from "@/hooks/useTipModal";
import { toast } from "sonner";

const socialIcons: Record<string, JSX.Element> = {
  twitter: <Twitter className="h-4 w-4" />,
  instagram: <Instagram className="h-4 w-4" />,
  discord: <DiscordIcon className="h-4 w-4" />,
  facebook: <FacebookIcon className="h-4 w-4" />,
};

interface ViewStreamProps {
  username: string;
  isLive?: boolean;
  onStatusChange?: (isLive: boolean) => void;
  isOwner?: boolean;
  userData?: any;
  isFollowing?: boolean;
  followerCount?: number;
  onFollow?: () => void;
  onUnfollow?: () => void;
  followLoading?: boolean;
}

// Mock API function to fetch stream data (fallback)
const fetchStreamData = async () => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Mock data
  return {
    isLive: true,
    title: "Intense Warzone Live - Sniper Duels & Tactical Plays",
    tags: ["video game", "gaming", "live"],
    viewCount: 14312,
    duration: "02:55:55",
    thumbnailUrl: "/Images/explore/home/featured-img.png",
    avatarUrl: "/Images/user.png",
    followers: 2000,
    bio: "Chidinma Cassandra is a seasoned product designer that has been designing digital products and creating seamless experiences for users interacting with blockchain and web 3 products.",
    socialLinks: {
      twitter: "https://twitter.com",
      instagram: "https://instagram.com",
      discord: "https://discord.gg",
    },
  };
};

// Mock chat messages

// TippingModal component
const TIPPING_CURRENCIES = [
  { label: "ETH", value: "ETH" },
  { label: "XLM", value: "XLM" },
  { label: "STRM", value: "STRM" },
  { label: "USDC", value: "USDC" },
];

function formatAddress(address: string) {
  if (!address) {
    return "";
  }
  return address.slice(0, 5) + "...." + address.slice(-5);
}

const TippingModal = ({
  isOpen,
  onClose,
  creatorAddress,
}: {
  isOpen: boolean;
  onClose: () => void;
  creatorAddress: string;
  username: string;
}) => {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("XLM");
  // Mock USD value for now
  const usdValue = amount && !isNaN(Number(amount)) ? (0).toFixed(2) : "0";

  const handleQuickSelect = (val: number) => {
    setAmount(val.toString());
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow numbers and decimals
    const val = e.target.value;
    if (/^\d*\.?\d*$/.test(val)) {
      setAmount(val);
    }
  };

  return isOpen ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#1D2027] rounded-2xl p-8 max-w-md w-full relative text-white shadow-lg">
        {/* Close button */}
        <button
          className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-[#35363C] hover:bg-[#44454B] text-2xl text-white/80"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold text-center mb-8">Tip to Creator</h2>
        <div className="mb-6 flex justify-center gap-8 items-center">
          <span className="text-gray-400 text-sm mb-1">Stellar address:</span>
          <span className="bg-[#18191C] px-4 py-2 rounded-lg font-mono text-base tracking-wider select-all">
            {formatAddress(creatorAddress)}
          </span>
        </div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-white text-base font-medium">Amount:</label>
          <span className="text-white text-base font-medium">
            {usdValue} <span className="text-gray-400 text-sm">USD</span>
          </span>
        </div>
        <div className="flex items-center mb-4">
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={handleAmountChange}
            placeholder="Enter amount"
            className="flex-1 bg-[#18191C] text-white rounded-l-lg px-4 py-3 text-base focus:outline-none border border-[#35363C] border-r-0"
          />
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            className="bg-[#18191C] text-white rounded-r-lg px-4 py-3 text-base border border-[#35363C] border-l-0 focus:outline-none"
          >
            {TIPPING_CURRENCIES.map(c => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-3 mb-6">
          {[1, 5, 10, 50, 100].map(val => (
            <button
              key={val}
              type="button"
              className={`px-5 py-2 rounded-full border border-[#35363C] text-white text-base font-medium transition-colors ${amount === val.toString() ? "bg-[#35363C]" : "bg-transparent hover:bg-[#2D2F31]"}`}
              onClick={() => handleQuickSelect(val)}
            >
              {val}
            </button>
          ))}
        </div>
        <button
          className="w-full py-4 rounded-xl text-lg font-semibold mt-2 transition-colors bg-[#5A189A] text-white disabled:bg-[#2D2F31] disabled:text-gray-400"
          disabled={!amount || isNaN(Number(amount)) || Number(amount) <= 0}
        >
          Tip Creator
        </button>
      </div>
    </div>
  ) : null;
};

interface PastRecording {
  id: string;
  playback_id: string;
  title: string | null;
  duration: number | null;
  created_at: string;
  stream_date: string | null;
}

function formatRecDuration(seconds: number | null): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function recTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? "s" : ""} ago`;
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? "s" : ""} ago`;
  return `${Math.floor(days / 365)} year${Math.floor(days / 365) > 1 ? "s" : ""} ago`;
}

const ViewStream = ({
  username,
  isLive: initialIsLive,
  onStatusChange,
  isOwner = false,
  userData,
  isFollowing = false,
  onFollow,
  onUnfollow,
  followLoading = false,
}: ViewStreamProps) => {
  const [isLive, setIsLive] = useState(initialIsLive);
  const [streamData, setStreamData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenElement, setFullscreenElement] = useState<Element | null>(
    null
  );
  const [showChat, setShowChat] = useState(true);
  const [showChatOverlay, setShowChatOverlay] = useState(true);
  const [chatOverlayMessage, setChatOverlayMessage] = useState("");
  const [showStreamInfoModal, setShowStreamInfoModal] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isSavingStreamInfo, setIsSavingStreamInfo] = useState(false);
  const [recordings, setRecordings] = useState<PastRecording[]>([]);

  // Use custom hooks for Stellar wallet and tip modal state
  const { publicKey, privyWallet } = useStellarWallet();
  // address covers both native Stellar wallet and Privy-embedded wallet
  const address = publicKey || privyWallet?.wallet || null;
  const tipModalState = useTipModal();

  const videoContainerRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const overlayScrollRef = useRef<HTMLDivElement>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);
  const {
    messages: chatMessages,
    sendMessage,
    isSending,
  } = useChat(userData?.playbackId, address, isLive);

  // Stable refs so the native keydown listener always reads current values
  const chatOverlayMessageRef = useRef(chatOverlayMessage);
  chatOverlayMessageRef.current = chatOverlayMessage;
  const isSendingRef = useRef(isSending);
  isSendingRef.current = isSending;

  // Use userData from props if available, otherwise fetch it
  useEffect(() => {
    const getStreamData = async () => {
      try {
        setLoading(true);

        if (userData) {
          // Use data from props
          const data = {
            isLive: initialIsLive || false,
            title: userData.streamTitle || `${username}'s Live Stream`,
            tags: userData.tags || ["live", "streaming"],
            viewCount: userData.viewCount || 0,
            duration: "00:00:00", // Live streams don't have duration
            thumbnailUrl: userData.avatar || "/Images/user.png",
            avatarUrl: userData.avatar || "/Images/user.png",
            followers: userData.followers?.length || 0,
            bio: userData.bio || `Welcome to ${username}'s stream!`,
            socialLinks: userData.socialLinks || {
              twitter: "",
              instagram: "",
              discord: "",
            },
            stellarAddress: userData.stellarAddress || "",
          };

          setStreamData(data);
          setIsLive(data.isLive);
          if (onStatusChange) {
            onStatusChange(data.isLive);
          }
        } else {
          // Fallback to API call if no userData provided
          const data = await fetchStreamData();
          setStreamData(data);
          setIsLive(data.isLive);
          if (onStatusChange) {
            onStatusChange(data.isLive);
          }
        }
      } catch (err) {
        setError("Failed to load stream data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    getStreamData();
  }, [username, onStatusChange, userData, initialIsLive]);

  // Fetch past recordings for this streamer
  useEffect(() => {
    fetch(`/api/streams/recordings?username=${encodeURIComponent(username)}&limit=6`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.recordings) setRecordings(data.recordings); })
      .catch(() => {});
  }, [username]);

  // Handle fullscreen change event
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fsEl = document.fullscreenElement;
      setIsFullscreen(!!fsEl);
      setFullscreenElement(fsEl);
      if (fsEl) {
        setShowChatOverlay(true);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
    };
  }, []);

  // Auto-scroll overlay chat when new messages arrive
  useEffect(() => {
    if (overlayScrollRef.current) {
      overlayScrollRef.current.scrollTop =
        overlayScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Native keydown listener: stops the event from reaching Mux Player's native
  // keyboard handler before it can call preventDefault on space (play/pause).
  // React's synthetic onKeyDown runs too late for this. Enter is also handled
  // here since stopPropagation prevents the React handler from firing.
  useEffect(() => {
    const input = overlayInputRef.current;
    if (!input) {
      return;
    }

    const handler = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (
        e.key === "Enter" &&
        !isSendingRef.current &&
        chatOverlayMessageRef.current.trim()
      ) {
        sendMessage(chatOverlayMessageRef.current);
        setChatOverlayMessage("");
      }
    };

    input.addEventListener("keydown", handler);
    return () => input.removeEventListener("keydown", handler);
  }, [isFullscreen, showChatOverlay, sendMessage]);

  const handleOverlaySendMessage = () => {
    if (!chatOverlayMessage.trim() || isSending) {
      return;
    }
    sendMessage(chatOverlayMessage);
    setChatOverlayMessage("");
  };

  // Handle chat toggle
  const toggleChat = () => {
    setShowChat(!showChat);
  };

  // Handle stream info save — persists to DB then updates local state
  const handleSaveStreamInfo = async (data: any) => {
    if (!address) {
      toast.error("Not authenticated");
      return;
    }
    setIsSavingStreamInfo(true);
    try {
      const formData = new FormData();
      formData.append(
        "creator",
        JSON.stringify({
          title: data.title,
          description: data.description,
          category: data.category,
          tags: data.tags,
        })
      );
      const res = await fetch(`/api/users/updates/${address}`, {
        method: "PUT",
        body: formData,
      });
      if (res.ok) {
        setStreamData({
          ...streamData,
          title: data.title,
          bio: data.description,
          tags: data.tags,
        });
        toast.success("Stream info updated");
      } else {
        toast.error("Failed to save stream info");
      }
    } catch {
      toast.error("Failed to save stream info");
    } finally {
      setIsSavingStreamInfo(false);
      setShowStreamInfoModal(false);
    }
  };

  if (loading) {
    return <ViewStreamSkeleton />;
  }

  if (error || !streamData) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-[#17191A]">
        <div className="text-white">{error || "Failed to load stream"}</div>
      </div>
    );
  }

  return (
    <DashboardScreenGuard>
      <div className="bg-background text-foreground border border-border flex flex-col h-full bg-[#17191A]">
        <div className="flex flex-1 items-start relative overflow-hidden">
          {/* Main content */}
          <div
            ref={mainContentRef}
            className="flex-1 flex flex-col overflow-y-auto scrollbar-hide"
            style={{ height: "calc(100vh - 64px)" }}
          >
            {/* Video player container - modified for fullscreen layout */}
            <div
              ref={videoContainerRef}
              className={`relative bg-black overflow-hidden group ${isFullscreen ? "flex h-screen" : "aspect-video"}`}
            >
              {/* Video content area */}
              <div
                className={`relative ${isFullscreen ? "flex-1" : "w-full h-full"}`}
              >
                {isLive && userData?.playbackId ? (
                  <MuxPlayer
                    playbackId={userData.playbackId}
                    streamType="live:dvr"
                    autoPlay="muted"
                    metadata={{
                      video_id: userData.playbackId,
                      video_title: streamData.title || `${username}'s Stream`,
                      viewer_user_id: "anonymous",
                    }}
                    primaryColor="#ac39f2"
                    className="w-full h-full"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                    <div className="text-white text-center">
                      <p className="text-lg mb-2">
                        {isLive ? "Loading stream..." : "Stream is offline"}
                      </p>
                      <p className="text-sm text-gray-400">
                        {isLive
                          ? "Please wait while we load the stream"
                          : "Check back later or browse past streams below"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Stream info overlay in fullscreen (visible on hover) */}
                {isFullscreen && (
                  <div
                    className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ zIndex: 10 }}
                  >
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full overflow-hidden mr-3">
                        <Image
                          src={streamData.avatarUrl || "/Images/user.png"}
                          alt={username}
                          width={40}
                          height={40}
                          className="object-cover"
                        />
                      </div>
                      <div>
                        <h2 className="text-white font-medium">{username}</h2>
                        <p className="text-gray-300 text-sm">
                          {streamData.title}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Transparent overlay chat portaled into fullscreen element */}
            {isFullscreen &&
              fullscreenElement &&
              createPortal(
                <AnimatePresence>
                  {showChatOverlay ? (
                    <motion.div
                      key="chat-overlay"
                      initial={{ x: 400, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 400, opacity: 0 }}
                      transition={{
                        type: "spring",
                        damping: 30,
                        stiffness: 300,
                      }}
                      className="absolute right-4 top-4 bottom-20 w-80 flex flex-col pointer-events-auto z-[100]"
                      style={{ maxHeight: "calc(100vh - 8rem)" }}
                    >
                      <div className="flex flex-col h-full bg-gradient-to-b from-black/40 via-black/30 to-black/40 backdrop-blur-sm rounded-lg overflow-hidden">
                        {/* Header */}
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
                          >
                            <X size={16} className="text-white" />
                          </button>
                        </div>

                        {/* Messages */}
                        <div
                          ref={overlayScrollRef}
                          className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
                        >
                          <div className="text-xs text-white/60 text-center py-2">
                            Welcome to live chat!
                          </div>
                          <div className="flex flex-col gap-2">
                            {chatMessages.map(msg => (
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
                                    <span
                                      className="text-xs font-semibold"
                                      style={{ color: msg.color }}
                                    >
                                      {msg.username}
                                    </span>
                                    <p className="text-white text-sm break-words">
                                      {msg.message}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Input */}
                        <div className="p-3 bg-black/50 backdrop-blur-md border-t border-white/10">
                          {!!address ? (
                            <div className="flex items-center gap-2">
                              <input
                                ref={overlayInputRef}
                                type="text"
                                value={chatOverlayMessage}
                                onChange={e =>
                                  setChatOverlayMessage(e.target.value)
                                }
                                placeholder="Say something..."
                                disabled={isSending}
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck={false}
                                className="flex-1 bg-white/10 text-white text-sm px-3 py-2 rounded-lg border border-white/20 focus:border-purple-500 focus:bg-white/15 focus:outline-none placeholder-white/50 disabled:opacity-50"
                              />
                              <button
                                onClick={handleOverlaySendMessage}
                                disabled={
                                  !chatOverlayMessage.trim() || isSending
                                }
                                className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors"
                              >
                                <Send size={16} />
                              </button>
                            </div>
                          ) : (
                            <p className="text-white/50 text-xs text-center">
                              Connect wallet to chat
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="chat-toggle"
                      initial={{ x: 100, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 100, opacity: 0 }}
                      onClick={() => setShowChatOverlay(true)}
                      className="absolute right-4 top-20 bg-black/70 backdrop-blur-md text-white px-4 py-2 rounded-lg border border-white/20 hover:bg-black/80 transition-all z-[100] flex items-center gap-2"
                    >
                      <MessageCircle size={16} />
                      <span className="text-sm font-semibold">Chat</span>
                    </motion.button>
                  )}
                </AnimatePresence>,
                fullscreenElement
              )}

            {/* Stream info - only show when not in fullscreen */}
            {!isFullscreen && (
              <>
                <div className="text-muted-foreground border-b border-gray- p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="relative w-12 h-12 rounded-full overflow-hidden bg-purple-600">
                        <Image
                          src={streamData.avatarUrl || "/Images/user.png"}
                          alt={username}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div>
                        <h1 className="text- font-medium">{username}</h1>
                        <h2 className="-400 text-sm">{streamData.title}</h2>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {streamData.tags.map((tag: string) => (
                            <span
                              key={tag}
                              className="text-xs bg-[#2D2F31] text-gray-300 px-2 py-0.5 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <div className="flex items-center space-x-2">
                        {isOwner ? (
                          <Button
                            // onClick={() => setShowStreamInfoModal(true)}
                            variant="outline"
                            onClick={() => setShowStreamInfoModal(true)}
                            className="bg-[#2D2F31] hover:bg-[#3D3F41] text-white border-none"
                          >
                            <Edit3 className="h-4 w-4 mr-2" />
                            Edit Stream Info
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              className={
                                isFollowing
                                  ? "bg-gray-700 hover:bg-gray-600 text-white border-none"
                                  : "bg-purple-600 hover:bg-purple-700 text-white border-none"
                              }
                              onClick={isFollowing ? onUnfollow : onFollow}
                              disabled={followLoading}
                            >
                              {followLoading ? "…" : isFollowing ? "Unfollow" : "Follow"}
                            </Button>
                            {/* Stellar Tip Button */}
                            {streamData.starknetAddress && publicKey && publicKey !== streamData.starknetAddress ? (
                              <TipButton
                                recipientUsername={username}
                                recipientPublicKey={streamData.starknetAddress}
                                onTipClick={tipModalState.openTipModal}
                                variant="outline"
                                className="bg-[#2D2F31] hover:bg-[#3D3F41] text-white border-gray-600"
                              />
                            ) : (
                              <Button
                                variant="outline"
                                className="bg-[#2D2F31] hover:bg-[#3D3F41] text-white border-gray-600"
                                disabled
                                title={!publicKey ? "Connect Stellar wallet to tip" : !streamData.starknetAddress ? "Streamer hasn't set up Stellar wallet" : "Cannot tip yourself"}
                              >
                                <Gift className="h-4 w-4 mr-2" />
                                Send Tip
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              className="p-0 w-7 h- border-none focus:ring-0 focus:ring-offset-0 "
                            >
                              <Share2 className="w-7 h-7" />
                            </Button>
                            <button>
                              <Menu />
                            </button>
                          </>
                        )}
                      </div>
                      <div className="mt-4">
                        <div className="flex items-center -400 text-sm">
                          <Users className="h-4 w-4 mr-1" />
                          <span>
                            {streamData.viewCount.toLocaleString()} viewers
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Report Live Stream Button */}
                {!isOwner && (
                  <div className="p-4 border-b border-gray-800">
                    <div className="flex justify-end">
                      <Button
                        onClick={() => setShowReportModal(true)}
                        variant="outline"
                        className="bg-[#2D2F31] hover:bg-[#3D3F41] text-white border-gray-600 text-xs px-3 py-2 h-8"
                      >
                        <Flag className="h-3 w-3 mr-2" />
                        Report Live Stream
                      </Button>
                    </div>
                  </div>
                )}

                {/* About section */}
                <div className={"p-4 border-b border-gray-"}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text- font-medium mb-">About {username}</h3>
                    <div className="flex space-x-4 items-center mt-2">
                      {Object.entries(streamData.socialLinks).map(
                        ([platform, url]) => (
                          <a
                            key={platform}
                            href={String(url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className=" flex gap-2 items-center capitalize" //add hover effect
                            title={platform}
                          >
                            <span>{platform}</span>
                            <span>{socialIcons[platform.toLowerCase()]}</span>
                          </a>
                        )
                      )}
                    </div>
                  </div>
                  <p className=" text-sm line-clamp-2">{streamData.bio}</p>
                </div>

                {/* Past streams */}
                {recordings.length > 0 && (
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium">Past Streams</h3>
                      <Link
                        href={`/${username}/clips`}
                        className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        View all
                      </Link>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {recordings.map(rec => {
                        const thumb = `https://image.mux.com/${rec.playback_id}/thumbnail.jpg?width=480&time=5`;
                        const title = rec.title ?? `Stream — ${recTimeAgo(rec.stream_date ?? rec.created_at)}`;
                        return (
                          <Link
                            key={rec.id}
                            href={`/${username}/clips/${rec.id}`}
                            className="group bg-background rounded-md overflow-hidden hover:ring-1 hover:ring-purple-500/50 transition-all block"
                          >
                            <div className="aspect-video relative bg-black overflow-hidden">
                              <img
                                src={thumb}
                                alt={title}
                                className="w-full h-full object-cover"
                              />
                              {rec.duration && (
                                <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-xs px-1 py-0.5 rounded font-mono">
                                  {formatRecDuration(rec.duration)}
                                </span>
                              )}
                            </div>
                            <div className="p-2">
                              <h4 className="text-sm font-medium truncate text-foreground">{title}</h4>
                              <p className="text-gray-400 text-xs mt-0.5">
                                {recTimeAgo(rec.stream_date ?? rec.created_at)}
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Chat sidebar (non-fullscreen) */}
          {!isFullscreen && (
            <div
              className={`transition-all flex-shrink-0 duration-300 ease-in-out ${showChat ? "w-[30%]" : "w-0"}`}
            >
              <ChatSection
                messages={chatMessages}
                onSendMessage={sendMessage}
                isCollapsible={true}
                isFullscreen={false}
                className="border border-border h-full border-l"
                onToggleChat={toggleChat}
                showChat={showChat}
                isWalletConnected={!!address}
                isSending={isSending}
              />
            </div>
          )}

          {/* Collapsed chat button (non-fullscreen) */}
          {!showChat && !isFullscreen && (
            <button
              onClick={toggleChat}
              className="absolute right-0 top-0 z-20 w-10 p-3 border-gray-800 flex items-center justify-center text-white transition-colors hover:text-gray-300"
              aria-label="Show chat"
            >
              <ChevronRight className="h-5 w-5 rotate-180" />
            </button>
          )}
        </div>
      </div>

      {/* Stream Info Modal */}
      {showStreamInfoModal && (
        <StreamInfoModal
          initialData={{
            title: streamData.title,
            description: streamData.bio,
            category: "Gaming",
            tags: streamData.tags,
            thumbnail: streamData.thumbnailUrl,
          }}
          onClose={() => setShowStreamInfoModal(false)}
          onSave={handleSaveStreamInfo}
          isSaving={isSavingStreamInfo}
          dashboardHref="/dashboard/stream-manager"
        />
      )}

      {/* Tipping Modal */}
      {showTipModal && (
        <TippingModal
          isOpen={showTipModal}
          onClose={() => setShowTipModal(false)}
          creatorAddress={
            streamData.stellarAddress ||
            "0x5sddf6c7df6c7df6c7df6c7df6c7df6c7df6c7df6c"
          }
          username={username}
        />
      )}

      {/* Report Live Stream Modal */}
      <ReportLiveStreamModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        username={username}
      />

      {/* Stellar Tip Modals */}
      <TipModalContainer
        isModalOpen={tipModalState.showTipModal}
        onModalClose={tipModalState.closeTipModal}
        recipientUsername={username}
        recipientPublicKey={streamData?.stellarAddress || ""}
        recipientAvatar={streamData?.avatarUrl}
        senderPublicKey={publicKey}
        onSuccess={tipModalState.showSuccess}
        onError={tipModalState.showError}
        confirmationState={tipModalState.tipConfirmation}
        onConfirmationClose={tipModalState.closeConfirmation}
        onRetry={tipModalState.retryFromConfirmation}
      />
    </DashboardScreenGuard>
  );
};

export default ViewStream;

