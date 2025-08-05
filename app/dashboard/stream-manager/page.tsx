"use client";

import type React from "react";

import { useState, useEffect } from "react";
import StreamPreview from "@/components/dashboard/stream-manager/stream-preview";
import ActivityFeed from "@/components/dashboard/stream-manager/activity-feed";
import Chat from "@/components/dashboard/stream-manager/chat";
import StreamInfo from "@/components/dashboard/stream-manager/stream-info";
import StreamSettings from "@/components/dashboard/stream-manager/stream-settings";
import StreamInfoModal from "@/components/dashboard/common/stream-info-modal";
import { motion } from "framer-motion";
import { bgClasses, textClasses, borderClasses } from "@/lib/theme-classes";

export default function StreamManagerPage() {
  const [streamData, setStreamData] = useState({
    title: "Keeping up with Cassandra",
    category: "Gaming",
    description: "Late Night Grind - Leveling Up with the Crew!",
    tags: ["Tech", "Design"],
    thumbnail: "/placeholder.svg?height=640&width=1200",
  });

  const [isStreamInfoModalOpen, setIsStreamInfoModalOpen] = useState(false);
  const [streamSession, setStreamSession] = useState("00:00:00");
  const [stats, setStats] = useState({
    viewers: 0,
    followers: 0,
    donations: 0,
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Update stream timer
  useEffect(() => {
    const timer = setInterval(() => {
      setStreamSession((prev) => {
        try {
          const [hours, minutes, seconds] = prev.split(":").map(Number);
          if (isNaN(hours) || isNaN(minutes) || isNaN(seconds))
            throw new Error();

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

  interface StreamData {
    title: string;
    category: string;
    description: string;
    tags: string[];
    thumbnail: string;
  }

  interface StreamInfoUpdate {
    title?: string;
    category?: string;
    description?: string;
    tags?: string[];
    thumbnail?: string;
  }

  const handleStreamInfoUpdate = (newData: StreamInfoUpdate) => {
    setStreamData({ ...streamData, ...newData });
    setIsStreamInfoModalOpen(false);
    showToast("Stream info updated successfully!");
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <>
      <div
        className={`flex flex-col h-screen ${bgClasses.secondary} ${textClasses.primary}`}
      >
        {/* Stats Bar */}
        <div
          className={`flex justify-between items-center px-2 border-b ${borderClasses.primary}`}
        >
          <div className="flex space-x-4 ">
            <StatsCard title="Viewers" value={stats.viewers} />
            <StatsCard title="New followers" value={stats.followers} />
            <StatsCard title="Donations" value={stats.donations} />
          </div>
          <div className={textClasses.secondary}>
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
                  data={streamData}
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
        {isStreamInfoModalOpen && (
          <StreamInfoModal
            initialData={streamData}
            onClose={() => setIsStreamInfoModalOpen(false)}
            onSave={handleStreamInfoUpdate}
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
    className={`${bgClasses.card} px-4 py-1.5 rounded-md text-center border ${borderClasses.primary}`}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <div className={`text-xl font-bold ${textClasses.primary}`}>{value}</div>
    <div className={`text-xs ${textClasses.tertiary}`}>{title}</div>
  </motion.div>
);
