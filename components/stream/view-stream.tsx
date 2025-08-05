/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import type React from "react";
import { mockChatMessages } from "@/data/dashboard";
import {
  ChevronRight,
  Edit3,
  Gift,
  Instagram,
  Maximize,
  Pause,
  Play,
  Settings,
  Share2,
  X,
  Twitter,
  Users,
  Volume2,
  VolumeX,
  Menu,
} from "lucide-react";
import Image from "next/image";
import { JSX, useEffect, useRef, useState } from "react";
import { FaDiscord, FaFacebook } from "react-icons/fa";
import StreamInfoModal from "../dashboard/common/stream-info-modal";
import DashboardScreenGuard from "../explore/dashboard-screen-guard";
import { Button } from "../ui/button";
import ChatSection from "./chat-section";
import {
  bgClasses,
  borderClasses,
  combineClasses,
  textClasses,
} from "@/lib/theme-classes";
import { text } from "stream/consumers";
import { Flag } from "lucide-react";
import ReportLiveStreamModal from "../modals/report-live-stream-modal";

const socialIcons: Record<string, JSX.Element> = {
  twitter: <Twitter className="h-4 w-4" />,
  instagram: <Instagram className="h-4 w-4" />,
  discord: <FaDiscord className="h-4 w-4" />,
  facebook: <FaFacebook className="h-4 w-4" />,
};

interface ViewStreamProps {
  username: string;
  isLive?: boolean;
  onStatusChange?: (isLive: boolean) => void;
  isOwner?: boolean;
}

// Mock API function to fetch stream data
const fetchStreamData = async () => {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

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
  { label: "STRK", value: "STRK" },
  { label: "STRM", value: "STRM" },
  { label: "USDC", value: "USDC" },
];

function formatAddress(address: string) {
  if (!address) return "";
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
  const [currency, setCurrency] = useState("STRK");
  // Mock USD value for now
  const usdValue = amount && !isNaN(Number(amount)) ? (0).toFixed(2) : "0";

  const handleQuickSelect = (val: number) => {
    setAmount(val.toString());
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow numbers and decimals
    const val = e.target.value;
    if (/^\d*\.?\d*$/.test(val)) setAmount(val);
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
          <span className="text-gray-400 text-sm mb-1">Starknet address:</span>
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
            onChange={(e) => setCurrency(e.target.value)}
            className="bg-[#18191C] text-white rounded-r-lg px-4 py-3 text-base border border-[#35363C] border-l-0 focus:outline-none"
          >
            {TIPPING_CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-3 mb-6">
          {[1, 5, 10, 50, 100].map((val) => (
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

const ViewStream = ({
  username,
  isLive: initialIsLive,
  onStatusChange,
  isOwner = false,
}: ViewStreamProps) => {
  const [isLive, setIsLive] = useState(initialIsLive);
  const [streamData, setStreamData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [chatMessages, setChatMessages] = useState(mockChatMessages);
  const [showStreamInfoModal, setShowStreamInfoModal] = useState(false);
  const [volume, setVolume] = useState(80);
  const [, setShowControls] = useState(false);
  const [videoQuality, setVideoQuality] = useState("720p");
  const [showQualityOptions, setShowQualityOptions] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const videoContainerRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Fetch stream data on component mount
  useEffect(() => {
    const getStreamData = async () => {
      try {
        setLoading(true);
        const data = await fetchStreamData();
        setStreamData(data);

        // Update live status
        setIsLive(data.isLive);
        if (onStatusChange) {
          onStatusChange(data.isLive);
        }
      } catch (err) {
        setError("Failed to load stream data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    getStreamData();
  }, [username, onStatusChange]);

  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return;

    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Handle fullscreen change event
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Handle chat toggle
  const toggleChat = () => {
    setShowChat(!showChat);
  };

  // Handle sending a chat message
  const handleSendMessage = (message: string) => {
    const newMessage = {
      id: chatMessages.length + 1,
      username: "You",
      message: message,
      color: "#9333ea",
    };

    setChatMessages([...chatMessages, newMessage]);
  };

  // Handle stream info save
  const handleSaveStreamInfo = (data: any) => {
    setStreamData({
      ...streamData,
      title: data.title,
      bio: data.description,
      tags: data.tags,
    });
    setShowStreamInfoModal(false);
  };

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number.parseInt(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  // Toggle mute
  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      setVolume(volume === 0 ? 80 : volume); // Restore previous volume if it was 0
    } else {
      setIsMuted(true);
    }
  };

  // Handle video quality change
  const changeQuality = (quality: string) => {
    setVideoQuality(quality);
    setShowQualityOptions(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-[#17191A]">
        <div className="text-white">Loading stream...</div>
      </div>
    );
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
      <div
        className={combineClasses(
          bgClasses.primary,
          textClasses.primary,
          borderClasses.primary,
          `flex flex-col h-full bg-[#17191A]`
        )}
      >
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
              className={`relative bg-black group ${isFullscreen ? "flex h-screen" : "aspect-video"}`}
            >
              {/* Video content area */}
              <div
                className={`relative ${isFullscreen ? "flex-1" : "w-full h-full"}`}
              >
                {isLive ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-white text-center">
                      <div className="bg-red-600 text-white text-xs px-2 py-1 rounded-sm inline-block mb-4">
                        Live
                      </div>
                      <p className="text-lg">Live Stream Content</p>
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                    <div className="text-white text-center">
                      <p className="text-lg mb-2">Stream is offline</p>
                      <p className="text-sm text-gray-400">
                        Check back later or browse past streams below
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

                {isFullscreen && !showChat && (
                  <div className="absolute right-0 top-3 z-30 text-white cursor-pointer transition-colors hover:text-gray-300">
                    <ChevronRight onClick={toggleChat} />
                  </div>
                )}

                {/* Video controls */}
                <div
                  className="absolute bottom-0 left-0 right-0 flex flex-col p-4 bg-gradient-to-t from-black/80 to-transparent opacity-100 group-hover:opacity-100 transition-opacity"
                  onMouseEnter={() => setShowControls(true)}
                  onMouseLeave={() => setShowControls(false)}
                >
                  {/* Progress bar */}
                  <div className="w-full bg-gray-600 h-0.5 rounded-full overflow-hidden mb-4">
                    <div className="bg-white h-full w-1/2"></div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <button
                        className="text-white"
                        onClick={() => setIsPlaying(!isPlaying)}
                        aria-label={isPlaying ? "Pause" : "Play"}
                      >
                        {isPlaying ? (
                          <Pause className="h-5 w-5" />
                        ) : (
                          <Play className="h-5 w-5" />
                        )}
                      </button>

                      <div className="flex items-center space-x-2 group/volume">
                        <button
                          className="text-white"
                          onClick={toggleMute}
                          aria-label={isMuted ? "Unmute" : "Mute"}
                        >
                          {isMuted || volume === 0 ? (
                            <VolumeX className="h-5 w-5" />
                          ) : (
                            <Volume2 className="h-5 w-5" />
                          )}
                        </button>
                        <div className="w-0 overflow-hidden group-hover/volume:w-20 transition-all duration-300">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={isMuted ? 0 : volume}
                            onChange={handleVolumeChange}
                            className="w-full accent-white"
                          />
                        </div>
                      </div>
                    </div>
                    <span className="text-white text-xs">
                      {streamData.duration}
                    </span>

                    <div className="flex items-center space-x-3">
                      {/* Quality selector */}
                      <div className="relative">
                        <button
                          className="text-white flex items-center space-x-1"
                          onClick={() =>
                            setShowQualityOptions(!showQualityOptions)
                          }
                          aria-label="Video quality"
                        >
                          <Settings className="h-4 w-4" />
                          <span className="text-xs">{videoQuality}</span>
                        </button>

                        {showQualityOptions && (
                          <div className="absolute bottom-full right-0 mb-2 bg-black/90 rounded-md overflow-hidden">
                            {["1080p", "720p", "480p", "360p", "Auto"].map(
                              (quality) => (
                                <button
                                  key={quality}
                                  className={`block w-full text-left px-4 py-2 text-xs ${
                                    videoQuality === quality
                                      ? "bg-gray-700 text-white"
                                      : "text-gray-300 hover:bg-gray-800"
                                  }`}
                                  onClick={() => changeQuality(quality)}
                                >
                                  {quality}
                                </button>
                              )
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        className="text-white"
                        onClick={toggleFullscreen}
                        aria-label={
                          isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                        }
                      >
                        <Maximize className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fullscreen chat - now sits beside the video */}
              {isFullscreen && showChat && (
                <div
                  className={combineClasses(
                    borderClasses.secondary,
                    "w-[350px] flex-shrink-0 bg-black border-l border-gray-"
                  )}
                >
                  <ChatSection
                    messages={chatMessages}
                    onSendMessage={handleSendMessage}
                    isCollapsible={true}
                    isFullscreen={true}
                    className="h-full"
                    onToggleChat={toggleChat}
                    showChat={showChat}
                  />
                </div>
              )}
            </div>

            {/* Stream info - only show when not in fullscreen */}
            {!isFullscreen && (
              <>
                <div
                  className={combineClasses(
                    textClasses.secondary,
                    "border-b border-gray- p-4"
                  )}
                >
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
                            onClick={() => setShowTipModal(true)}
                            className="bg-[#2D2F31] hover:bg-[#3D3F41] text-white border-none"
                          >
                            <Edit3 className="h-4 w-4 mr-2" />
                            Edit Stream Info
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              className="bg-purple-600 hover:bg-purple-700 text-white border-none"
                            >
                              Follow
                            </Button>
                            <Button
                              variant="outline"
                              className="bg-[#2D2F31] hover:bg-[#3D3F41] text-white border-gray-600"
                            >
                              <Gift className="h-4 w-4 mr-2" />
                              Gift
                            </Button>
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
                <div className="p-4">
                  <h3 className="font-medium mb-4">Past Streams</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Past streams would be populated here */}
                    <div
                      className={combineClasses(
                        bgClasses.primary,
                        "bg-[#] rounded-md overflow-hidden"
                      )}
                    >
                      <div className="aspect-video relative">
                        <Image
                          src="/Images/explore/home/trending-streams/img1.png"
                          alt="Past stream"
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="p-3">
                        <h4 className="text- text-sm font-medium truncate">
                          Previous Stream Highlight
                        </h4>
                        <p className="text-gray-400 text-xs mt-1">
                          2 days ago • 45K views
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
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
                onSendMessage={handleSendMessage}
                isCollapsible={true}
                isFullscreen={false}
                className={combineClasses(
                  borderClasses.primary,
                  "h-full border-l "
                )}
                onToggleChat={toggleChat}
                showChat={showChat}
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
          />
        )}
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
        />
      )}

      {/* Tipping Modal */}
      {showTipModal && (
        <TippingModal
          isOpen={showTipModal}
          onClose={() => setShowTipModal(false)}
          creatorAddress={
            streamData.starknetAddress ||
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
    </DashboardScreenGuard>
  );
};

export default ViewStream;
