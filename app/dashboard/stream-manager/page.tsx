"use client";

import { useState, useEffect } from "react";
import StreamPreview from "@/components/dashboard/stream-manager/StreamPreview";
import ActivityFeed from "@/components/dashboard/stream-manager/ActivityFeed";
import Chat from "@/components/dashboard/stream-manager/Chat";
import StreamInfo from "@/components/dashboard/stream-manager/StreamInfo";
import StreamSettings from "@/components/dashboard/stream-manager/StreamSettings";
import StreamInfoModal from "@/components/dashboard/common/StreamInfoModal";
import { motion } from "framer-motion";

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
    <div className="flex flex-col h-screen bg-[#121212] text-white">
      {/* Stats Bar */}
      <div className="flex justify-between items-center p-4 border-b border-gray-800">
        <div className="flex space-x-4">
          <StatsCard title="Viewers" value={stats.viewers} />
          <StatsCard title="New followers" value={stats.followers} />
          <StatsCard title="Donations" value={stats.donations} />
        </div>
        <div className="text-gray-300">
          <span>Stream Session: </span>
          <span className="font-mono">{streamSession}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main Grid Layout */}
        <div className="grid grid-cols-12 gap-2 w-full p-2">
          {/* Stream Preview - Takes up 8 columns on large screens, full width on small */}
          <div className="col-span-10 lg:col-span-6 h-full">
            <div className="h-[calc(100vh-13rem)] lg:h-[calc(100vh-20rem)]">
              <StreamPreview />
            </div>
            <div className="h-48 mt-2">
              <ActivityFeed />
            </div>
          </div>

          {/* Chat - Takes up 2 columns on large screens */}
          <div className="col-span-12 lg:col-span-3 h-[calc(100vh-8rem)]">
            <Chat />
          </div>

          {/* Stream Info & Settings - Takes up 2 columns on large screens */}
          <div className="col-span-12 lg:col-span-3 flex flex-col gap-2 h-[calc(100vh-8rem)]">
            <div className="flex-1">
              <StreamInfo
                data={streamData}
                onEditClick={() => setIsStreamInfoModalOpen(true)}
              />
            </div>
            <div className="flex-1">
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
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg z-50">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

const StatsCard: React.FC<{ title: string; value: number }> = ({
  title,
  value,
}) => (
  <motion.div
    className="bg-gray-800 px-6 py-3 rounded-md text-center"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <div className="text-2xl font-bold">{value}</div>
    <div className="text-sm text-gray-400">{title}</div>
  </motion.div>
);
