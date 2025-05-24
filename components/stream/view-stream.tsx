"use client";

import type React from "react";

import { useState, useEffect, useRef } from "react";
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
  MessageSquare,
  ChevronRight,
  Send,
  Smile,
  GiftIcon,
  Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import StreamInfoModal from "@/components/dashboard/common/StreamInfoModal";

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
    thumbnailUrl: "/placeholder.svg?height=400&width=600",
    avatarUrl: "/placeholder.svg?height=64&width=64",
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
  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState(mockChatMessages);
  const [showStreamInfoModal, setShowStreamInfoModal] = useState(false);
  const [volume, setVolume] = useState(80);
  const [showControls, setShowControls] = useState(false);
  const [videoQuality, setVideoQuality] = useState("720p");
  const [showQualityOptions, setShowQualityOptions] = useState(false);

  const videoContainerRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
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
  const sendChatMessage = () => {
    if (!chatMessage.trim()) return;

    const newMessage = {
      id: chatMessages.length + 1,
      username: "You",
      message: chatMessage,
      color: "#9333ea",
    };

    setChatMessages([...chatMessages, newMessage]);
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
          {/* Video player */}
          <div
            ref={videoContainerRef}
            className="relative bg-black aspect-video group"
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
                style={{ zIndex: 20 }}
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full overflow-hidden mr-3">
                    <Image
                      src={
                        streamData.avatarUrl ||
                        "/placeholder.svg?height=40&width=40"
                      }
                      alt={username}
                      width={40}
                      height={40}
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <h2 className="text-white font-medium">{username}</h2>
                    <p className="text-gray-300 text-sm">{streamData.title}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Fullscreen chat */}
            {isFullscreen && showChat && (
              <div
                className="absolute top-0 right-0 z-20 bottom-0 w-[30%] bg-black/80 transition-all duration-300 ease-in-out"
                style={{ zIndex: 10 }}
              >
                <div className="flex flex-col h-full">
                  <div className="p-3 flex justify-between items-center border-b border-gray-800">
                    <h3 className="text-white font-medium">Chat</h3>
                    <button
                      onClick={toggleChat}
                      className="text-gray-400 hover:text-white transition-transform duration-300 transform rotate-0"
                      aria-label="Hide chat"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="relative flex-1 overflow-hidden">
                    {/* Gradient overlay at top */}
                    <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-black to-transparent z-10"></div>

                    <div
                      ref={chatContainerRef}
                      className="h-full overflow-y-auto scrollbar-hide p-3 space-y-4 pt-8 pb-16"
                    >
                      {chatMessages.map((message) => (
                        <div
                          key={message.id}
                          className="text-xs xl:text-sm flex"
                        >
                          <div
                            className="w-1 mr-2 rounded-full"
                            style={{ backgroundColor: message.color }}
                          ></div>
                          <div>
                            <span
                              className="font-medium"
                              style={{ color: message.color }}
                            >
                              {message.username}:{" "}
                            </span>
                            <span className="text-white">
                              {message.message}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Gradient overlay at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black to-transparent z-10"></div>
                  </div>

                  <div className="p-3 border-t border-gray-800">
                    <div className="relative">
                      <input
                        type="text"
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && sendChatMessage()
                        }
                        placeholder="Send a message"
                        className="w-full bg-[#2D2F31] text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                      <div className="absolute right-2 top-2 flex space-x-1">
                        <button className="text-gray-400 hover:text-white">
                          <Smile className="h-4 w-4" />
                        </button>
                        <button className="text-gray-400 hover:text-white">
                          <GiftIcon className="h-4 w-4" />
                        </button>
                        <button
                          className="text-gray-400 hover:text-white"
                          onClick={sendChatMessage}
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Fullscreen chat toggle button (when chat is hidden) */}
            {isFullscreen && !showChat && (
              <button
                onClick={toggleChat}
                className="absolute top-4 right-4 z-20 bg-black/60 p-2 rounded-full text-white hover:bg-black/80 transition-transform duration-300 transform rotate-180"
                aria-label="Show chat"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
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

                  {/* Volume control */}
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

                  <span className="text-white text-xs">
                    {streamData.duration}
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  {/* Quality selector */}
                  <div className="relative">
                    <button
                      className="text-white flex items-center space-x-1"
                      onClick={() => setShowQualityOptions(!showQualityOptions)}
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

          {/* Stream info */}
          <div className="border-b border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="relative w-12 h-12 rounded-full overflow-hidden bg-purple-600">
                  <Image
                    src={
                      streamData.avatarUrl ||
                      "/placeholder.svg?height=48&width=48"
                    }
                    alt={username}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <h1 className="text-white font-medium">{username}</h1>
                  <h2 className="text-gray-400 text-sm">{streamData.title}</h2>
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
                  </>
                )}
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center text-gray-400 text-sm">
                <Users className="h-4 w-4 mr-1" />
                <span>{streamData.viewCount.toLocaleString()} viewers</span>
              </div>
            </div>
          </div>

          {/* About section */}
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-white font-medium mb-2">About {username}</h3>
            <p className="text-gray-300 text-sm line-clamp-2">
              {streamData.bio}
            </p>

            <div className="flex space-x-4 mt-2">
              {streamData.socialLinks.twitter && (
                <a
                  href={streamData.socialLinks.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white"
                >
                  <Twitter className="h-4 w-4" />
                </a>
              )}
              {streamData.socialLinks.instagram && (
                <a
                  href={streamData.socialLinks.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white"
                >
                  <Instagram className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>

          {/* Past streams */}
          <div className="p-4">
            <h3 className="text-white font-medium mb-4">Past Streams</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Past streams would be populated here */}
              <div className="bg-[#2D2F31] rounded-md overflow-hidden">
                <div className="aspect-video relative">
                  <Image
                    src="/placeholder.svg?height=180&width=320"
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
        </div>

        {/* Chat sidebar */}
        {showChat && !isFullscreen && (
          <div className="w-[30%] border-l h-full border-gray-800 flex flex-col">
            <div className="p-3 border-b border-gray-800 flex justify-between items-center">
              <h3 className="text-white font-medium">Chat</h3>
              <button
                onClick={toggleChat}
                className="text-gray-400 hover:text-white transition-transform duration-300"
                aria-label="Hide chat"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="relative flex-1 overflow-hidden">
              {/* Gradient overlay at top */}
              <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-[#17191A] to-transparent z-10"></div>

              <div
                ref={chatContainerRef}
                className="h-full overflow-y-auto scrollbar-hide p-3 space-y-4 pt-8 pb-16"
              >
                {chatMessages.map((message) => (
                  <div key={message.id} className="text-xs xl:text-sm flex">
                    <div
                      className="w-1 mr-2 rounded-full"
                      style={{ backgroundColor: message.color }}
                    ></div>
                    <div>
                      <span
                        className="font-medium"
                        style={{ color: message.color }}
                      >
                        {message.username}:{" "}
                      </span>
                      <span className="text-white">{message.message}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Gradient overlay at bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#17191A] to-transparent z-10"></div>
            </div>

            <div className="p-3 border-t border-gray-800">
              <div className="relative">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                  placeholder="Send a message"
                  className="w-full bg-[#2D2F31] text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <div className="absolute right-2 top-2 flex space-x-1">
                  <button className="text-gray-400 hover:text-white">
                    <Smile className="h-4 w-4" />
                  </button>
                  <button className="text-gray-400 hover:text-white">
                    <GiftIcon className="h-4 w-4" />
                  </button>
                  <button
                    className="text-gray-400 hover:text-white"
                    onClick={sendChatMessage}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Collapsed chat button */}
        {!showChat && !isFullscreen && (
          <button
            onClick={toggleChat}
            className="absolute right-0 top-0 z-20 w-10  p-3 border-gray-800 flex items-center justify-center text-white transition-transform duration-300 transform rotate-180"
            aria-label="Show chat"
          >
            <ChevronRight className="h-5 w-5" />
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
