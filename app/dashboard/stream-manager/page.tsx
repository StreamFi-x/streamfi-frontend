"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useAccount } from "@starknet-react/core";
import StreamPreview from "@/components/dashboard/stream-manager/StreamPreview";
import ActivityFeed from "@/components/dashboard/stream-manager/ActivityFeed";
import Chat from "@/components/dashboard/stream-manager/Chat";
import StreamInfo from "@/components/dashboard/stream-manager/StreamInfo";
import StreamSettings from "@/components/dashboard/stream-manager/StreamSettings";
import StreamInfoModal from "@/components/dashboard/common/StreamInfoModal";
import { motion } from "framer-motion";

export default function StreamManagerPage() {
  const { address } = useAccount();
  const [streamData, setStreamData] = useState({
    title: "",
    category: "",
    description: "",
    tags: [] as string[],
    thumbnail: null as string | null,
  });
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [isStreamInfoModalOpen, setIsStreamInfoModalOpen] = useState(false);
  const [streamSession, setStreamSession] = useState("00:00:00");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch stream data on mount
  useEffect(() => {
    const fetchStreamData = async () => {
      if (!address) {
        setIsLoadingData(false);
        return;
      }

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

  // Update stream timer
  useEffect(() => {
    const timer = setInterval(() => {
      setStreamSession(prev => {
        try {
          const [hours, minutes, seconds] = prev.split(":").map(Number);
          if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
            throw new Error();
          }

          let newSeconds = seconds + 1;
          let newMinutes = minutes;
          let newHours = hours;

          if (newSeconds >= 60) {
            newSeconds = 0;
            newMinutes += 1;
          }

          if (newMinutes >= 60) {
            newMinutes = 0;
            newHours += 1;
          }

          return `${newHours.toString().padStart(2, "0")}:${newMinutes
            .toString()
            .padStart(2, "0")}:${newSeconds.toString().padStart(2, "0")}`;
        } catch {
          return "00:00:00"; // Reset to default on error
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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
        headers: {
          "Content-Type": "application/json",
        },
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
        setStreamData({
          title: result.streamData.title || "",
          category: result.streamData.category || "",
          description: result.streamData.description || "",
          tags: result.streamData.tags || [],
          thumbnail: result.streamData.thumbnail || null,
        });
        setIsStreamInfoModalOpen(false);
        showToast("Stream info updated successfully!");
      } else {
        const error = await response.json();
        showToast(error.error || "Failed to update stream info");
      }
    } catch (error) {
      console.error("Error updating stream info:", error);
      showToast("Failed to update stream info");
    } finally {
      setIsSaving(false);
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <>
      <div className="flex flex-col h-screen bg-secondary text-foreground">
        {/* Stats Bar */}
        <div className="flex justify-between items-center px-2 border-b border-border">
          <div className="flex space-x-4 ">
            <StatsCard title="Viewers" value={0} />
            <StatsCard title="New followers" value={0} />
            <StatsCard title="Donations" value={0} />
          </div>
          <div className="text-muted-foreground">
            <span>Stream Session: </span>
            <span className="font-mono">{streamSession}</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main Grid Layout */}
          <div className="grid grid-cols-12 gap-2 w-full p-2">
            {/* Stream Preview - Takes up 8 columns on large screens, full width on small */}
            <div className="col-span-10 lg:col-span-6 h-full w-full">
              <div className="h-[calc(100vh-13rem)] lg:h-[calc(100vh-20rem)]">
                <StreamPreview />
              </div>
              <div className="h-44 mt-2">
                <ActivityFeed />
              </div>
            </div>

            {/* Chat - Takes up 2 columns on large screens */}
            <div className="col-span-12 lg:col-span-3 h-[calc(100vh-9rem)]">
              <Chat />
            </div>

            {/* Stream Info & Settings - Takes up 2 columns on large screens */}
            <div className="col-span-12 lg:col-span-3 flex flex-col gap-2 h-[calc(100vh-8rem)]">
              {/* Stream Info - Dynamic height based on content */}
              <div>
                <StreamInfo
                  data={{
                    ...streamData,
                    thumbnail: streamData.thumbnail || undefined,
                  }}
                  onEditClick={() => setIsStreamInfoModalOpen(true)}
                />
              </div>

              {/* Stream Settings - Dynamic height based on content */}
              <div>
                <StreamSettings />
              </div>
            </div>
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

        {/* Toast Notification */}
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg z-50"
          >
            {toastMessage}
          </motion.div>
        )}
      </div>
    </>
  );
}

const StatsCard: React.FC<{ title: string; value: number }> = ({
  title,
  value,
}) => (
  <motion.div
    className="bg-card px-4 py-1.5 rounded-md text-center border border-border"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <div className="text-xl font-bold text-foreground">{value}</div>
    <div className="text-xs text-muted-foreground">{title}</div>
  </motion.div>
);
