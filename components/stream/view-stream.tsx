"use client";

import type React from "react";

import { useState, useEffect, useRef, JSX } from "react";
import Image from "next/image";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Settings,
  Gift,
  Users,
  Twitter,
  Instagram,
  ChevronRight,
  Edit3,
  Share2,
} from "lucide-react";
import Button from "../ui/Button";
import StreamInfoModal from "../dashboard/common/StreamInfoModal";
import ChatSection from "./chat-section";
import { FaDiscord, FaFacebook } from "react-icons/fa";

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
const fetchStreamData = async (username: string) => {
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
const mockChatMessages = [
  {
    id: 1,
    username: "Wagner",
    message: "First viewer joining in today",
    color: "#9333ea",
  },
  { id: 2, username: "Wolf", message: "Wait crates ?", color: "#10b981" },
  {
    id: 3,
    username: "Wagner",
    message: "First viewer joining in today",
    color: "#9333ea",
  },
  { id: 4, username: "Cleo", message: "Nyo in epi biko", color: "#f59e0b" },
  { id: 5, username: "Cleo", message: "Nyo in epi biko", color: "#f59e0b" },
  {
    id: 6,
    username: "Spencer Smith",
    message: "what game are we streaming today ?",
    color: "#ef4444",
  },
  {
    id: 7,
    username: "Wagner",
    message: "First viewer joining in today",
    color: "#9333ea",
  },
  {
    id: 8,
    username: "Hack",
    message: "Send Funds here: 0x0d7f7a8d9a7f8d9a7f8d9a7f8d9a7f8d9a7f8d9a",
    color: "#3b82f6",
  },
  {
    id: 9,
    username: "Spencer Smith",
    message: "what game are we streaming today ?",
    color: "#ef4444",
  },
  {
    id: 10,
    username: "Spencer Smith",
    message: "what game are we streaming today ?",
    color: "#ef4444",
  },
  {
    id: 11,
    username: "Spencer Smith",
    message: "what game are we streaming today ?",
    color: "#ef4444",
  },
  {
    id: 12,
    username: "Wagner",
    message: "First viewer joining in today",
    color: "#9333ea",
  },
];

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
  const [showControls, setShowControls] = useState(false);
  const [videoQuality, setVideoQuality] = useState("720p");
  const [showQualityOptions, setShowQualityOptions] = useState(false);

  const videoContainerRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Fetch stream data on component mount
  useEffect(() => {
    const getStreamData = async () => {
      try {
        setLoading(true);
        const data = await fetchStreamData(username);
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
    <div className="flex flex-col h-full bg-[#17191A]">
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
              <div className="w-[350px] flex-shrink-0 bg-black border-l border-gray-800">
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
              <div className="border-b border-gray-800 p-4">
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
                      <h1 className="text-white font-medium">{username}</h1>
                      <h2 className="text-gray-400 text-sm">
                        {streamData.title}
                      </h2>
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
                          onClick={() => setShowStreamInfoModal(true)}
                          variant="outline"
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
                            className="p-0 w-6 h-6 text-white border-none focus:ring-0 focus:ring-offset-0 hover:bg-[#2D2F31"
                          >
                            <Share2 className="w-5 h-5" />
                          </Button>
                        </>
                      )}
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center text-gray-400 text-sm">
                        <Users className="h-4 w-4 mr-1" />
                        <span>
                          {streamData.viewCount.toLocaleString()} viewers
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* About section */}
              <div className="p-4 border-b border-gray-800">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-white font-medium mb-">
                    About {username}
                  </h3>
                  <div className="flex space-x-4 items-center mt-2">
                    {Object.entries(streamData.socialLinks).map(
                      ([platform, url]) => (
                        <a
                          key={platform}
                          href={String(url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-white flex gap-2 items-center capitalize"
                          title={platform}
                        >
                          <span>{platform}</span>
                          <span>{socialIcons[platform.toLowerCase()]}</span>
                        </a>
                      )
                    )}
                  </div>
                </div>
                <p className="text-gray-300 text-sm line-clamp-2">
                  {streamData.bio}
                </p>
              </div>

              {/* Past streams */}
              <div className="p-4">
                <h3 className="text-white font-medium mb-4">Past Streams</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Past streams would be populated here */}
                  <div className="bg-[#2D2F31] rounded-md overflow-hidden">
                    <div className="aspect-video relative">
                      <Image
                        src="/Images/trending-streams/img1.png"
                        alt="Past stream"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="p-3">
                      <h4 className="text-white text-sm font-medium truncate">
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
              className="h-full border-l border-gray-800"
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
  );
};

export default ViewStream;
