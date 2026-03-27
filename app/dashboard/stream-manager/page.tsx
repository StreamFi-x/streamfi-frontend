"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import { useStreamData } from "@/hooks/useStreamData";
import StreamPreview from "@/components/dashboard/stream-manager/StreamPreview";
import ActivityFeed from "@/components/dashboard/stream-manager/ActivityFeed";
import Chat from "@/components/dashboard/stream-manager/Chat";
import StreamInfo from "@/components/dashboard/stream-manager/StreamInfo";
import StreamSettings from "@/components/dashboard/stream-manager/StreamSettings";
import StreamAccessSettings from "@/components/dashboard/stream-manager/StreamAccessSettings";
import ChatModerationSettings from "@/components/dashboard/stream-manager/ChatModerationSettings";
import StreamInfoModal from "@/components/dashboard/common/StreamInfoModal";
import { motion } from "framer-motion";
import { Users, UserPlus, Coins, Timer } from "lucide-react";

export default function StreamManagerPage() {
  const { publicKey, privyWallet } = useStellarWallet();
  const address = publicKey || privyWallet?.wallet || null;
  const { streamData: liveStreamData } = useStreamData(address ?? undefined);
  const isLive = liveStreamData?.isLive ?? false;

  const [username, setUsername] = useState<string | null>(null);
  const [streamData, setStreamData] = useState({
    title: "",
    category: "",
    description: "",
    tags: [] as string[],
    thumbnail: null as string | null,
    accessType: "public",
    accessConfig: {} as any,
  });
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isStreamInfoModalOpen, setIsStreamInfoModalOpen] = useState(false);
  const [streamSession, setStreamSession] = useState("00:00:00");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Format seconds into HH:MM:SS
  const formatElapsed = (startedAt: string | null, live: boolean): string => {
    if (!live || !startedAt) {
      return "00:00:00";
    }
    const elapsed = Math.max(
      0,
      Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
    );
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Resolve username
  useEffect(() => {
    const stored = sessionStorage.getItem("username");
    if (stored) {
      setUsername(stored);
      return;
    }
    if (privyWallet?.username) {
      setUsername(privyWallet.username);
    }
  }, [privyWallet]);

  // Fetch stream data
  useEffect(() => {
    if (!address) {
      setIsLoadingData(false);
      return;
    }

    const fetchStreamData = async () => {
      try {
        const response = await fetch(`/api/streams/${address}`);
        if (response.ok) {
          const data = await response.json();
          const creator = data.stream?.creator || {};
          setStreamData({
            title: creator.streamTitle || "",
            category: creator.category || "",
            description: creator.description || "",
            tags: creator.tags || [],
            thumbnail: creator.thumbnail || null,
            accessType: data.streamData?.stream?.stream_access_type || "public",
            accessConfig: data.streamData?.stream?.stream_access_config || {},
          });
        }
      } catch (error) {
        console.error("Error fetching stream data:", error);
        showToast("Failed to load stream data");
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchStreamData();
  }, [address]);

  // Session timer — recalculates every second from the server-provided startedAt.
  // Resets cleanly when the stream goes offline or startedAt changes.
  useEffect(() => {
    const startedAt = liveStreamData?.startedAt ?? null;
    const live = isLive;
    setStreamSession(formatElapsed(startedAt, live));
    if (!live || !startedAt) {
      return;
    }
    const timer = setInterval(() => {
      setStreamSession(formatElapsed(startedAt, true));
    }, 1000);
    return () => clearInterval(timer);
  }, [isLive, liveStreamData?.startedAt]);

  interface StreamInfoUpdate {
    title?: string;
    category?: string;
    description?: string;
    tags?: string[];
    thumbnail?: string;
  }

  const handleStreamInfoUpdate = async (newData: StreamInfoUpdate) => {
    if (!address) {
      showToast("Wallet not connected");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/streams/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: address,
          title: newData.title,
          description: newData.description,
          category: newData.category,
          tags: newData.tags,
          thumbnail: newData.thumbnail,
        }),
      });
      if (response.ok) {
        const result = await response.json();
        setStreamData((prev) => ({
          ...prev,
          title: result.streamData.title || "",
          category: result.streamData.category || "",
          description: result.streamData.description || "",
          tags: result.streamData.tags || [],
          thumbnail: result.streamData.thumbnail || null,
        }));
        setIsStreamInfoModalOpen(false);
        showToast("Stream info updated!");
      } else {
        const err = await response.json();
        showToast(err.error || "Failed to update stream info");
      }
    } catch {
      showToast("Failed to update stream info");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAccessPolicyUpdate = async (
    accessType: string,
    accessConfig: any
  ) => {
    if (!address) {
      showToast("Wallet not connected");
      return;
    }
    const userEmail = sessionStorage.getItem("userEmail") || privyWallet?.email || "";
    if (!userEmail) {
      showToast("Session expired, please refresh");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/users/update-creator", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          creator: {
            ...streamData,
            stream_access_type: accessType,
            stream_access_config: accessConfig,
          },
        }),
      });

      if (response.ok) {
        setStreamData({
          ...streamData,
          accessType,
          accessConfig,
        });
        showToast("Access policy updated!");
      } else {
        const err = await response.json();
        showToast(err.error || "Failed to update access policy");
      }
    } catch {
      showToast("Failed to update access policy");
    } finally {
      setIsSaving(false);
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="flex flex-col bg-secondary text-foreground">
      {/* Stats Bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <StatsChip
            icon={<Users className="w-3.5 h-3.5" />}
            label="Viewers"
            value={liveStreamData?.currentViewers ?? 0}
          />
          <StatsChip
            icon={<UserPlus className="w-3.5 h-3.5" />}
            label="Followers"
            value={liveStreamData?.followerCount ?? 0}
          />
          <StatsChip
            icon={<Coins className="w-3.5 h-3.5" />}
            label="Tips"
            value={0}
          />
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-mono">
          <Timer className="w-4 h-4" />
          <span>{streamSession}</span>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-12 gap-3 p-3">
        {/* Left column: Stream preview + Activity feed */}
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-3">
          <div className="aspect-video w-full shrink-0">
            <StreamPreview />
          </div>
          <div className="flex-1 min-h-0">
            <ActivityFeed
              sessionTime={streamSession}
              viewerCount={liveStreamData?.currentViewers ?? 0}
              username={username}
              isLive={isLive}
            />
          </div>
        </div>

        {/* Right column: Chat + Stream info + Chat moderation + Tip wallet */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-3">
          <div className="h-96">
            <Chat />
          </div>
          <StreamInfo
            data={{
              ...streamData,
              thumbnail: streamData.thumbnail || undefined,
            }}
            onEditClick={() => setIsStreamInfoModalOpen(true)}
          />
          <StreamAccessSettings
            initialAccessType={streamData.accessType}
            initialAccessConfig={streamData.accessConfig}
            onSave={handleAccessPolicyUpdate}
            isSaving={isSaving}
          />
          <ChatModerationSettings />
          <StreamSettings />
        </div>
      </div>

      {/* Stream Info Modal */}
      {isStreamInfoModalOpen && !isLoadingData && (
        <StreamInfoModal
          initialData={streamData}
          onClose={() => setIsStreamInfoModalOpen(false)}
          onSave={handleStreamInfoUpdate}
          isSaving={isSaving}
        />
      )}

      {/* Toast */}
      {toastMessage && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm font-medium"
        >
          {toastMessage}
        </motion.div>
      )}
    </div>
  );
}

function StatsChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <motion.div
      className="flex items-center gap-2 bg-secondary border border-border px-3 py-1.5 rounded-lg"
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-muted-foreground">{icon}</div>
      <span className="text-sm font-bold text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground hidden sm:block">
        {label}
      </span>
    </motion.div>
  );
}
