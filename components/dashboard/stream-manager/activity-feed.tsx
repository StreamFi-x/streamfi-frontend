"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, X } from "lucide-react";
import { bgClasses, textClasses, borderClasses } from "@/lib/theme-classes";

// Placeholder data
const initialActivities = [
  {
    id: "1",
    type: "follow",
    username: "Chidinma Cassandra",
    timestamp: new Date().getTime() - 1000 * 60 * 5, // 5 minutes ago
    avatar: "/placeholder.svg?height=40&width=40",
  },
  {
    id: "2",
    type: "follow",
    username: "Chidinma Cassandra",
    timestamp: new Date().getTime() - 1000 * 60 * 10, // 10 minutes ago
    avatar: "/placeholder.svg?height=40&width=40",
  },
  {
    id: "3",
    type: "follow",
    username: "Chidinma Cassandra",
    timestamp: new Date().getTime() - 1000 * 60 * 15, // 15 minutes ago
    avatar: "/placeholder.svg?height=40&width=40",
  },
];

export default function ActivityFeed() {
  const [activities, setActivities] = useState(initialActivities);
  const [isMinimized, setIsMinimized] = useState(false);

  // Simulate new activities coming in
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        // 30% chance of new activity
        const newActivity = {
          id: Date.now().toString(),
          type: "follow",
          username: "Chidinma Cassandra",
          timestamp: Date.now(),
          avatar: "/placeholder.svg?height=40&width=40",
        };

        setActivities((prev) => [newActivity, ...prev.slice(0, 9)]); // Keep only 10 most recent
      }
    }, 15000); // Check every 15 seconds

    return () => clearInterval(interval);
  }, []);

  if (isMinimized) {
    return (
      <div className="p-2">
        <button
          onClick={() => setIsMinimized(false)}
          className={`flex items-center space-x-2 ${textClasses.tertiary} hover:${textClasses.primary} transition-colors`}
        >
          <Activity size={18} />
          <span>Show Activity Feed</span>
        </button>
      </div>
    );
  }

  return (
    <motion.div
      className="h-full flex flex-col rounded-md overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div
        className={`${bgClasses.card} p-2 flex justify-between items-center border-b ${borderClasses.primary}`}
      >
        <div className="flex items-center">
          <Activity size={18} className={`mr-2 ${textClasses.primary}`} />
          <span className={textClasses.primary}>Activity Feed</span>
        </div>
        <div className="flex space-x-2">
          <button
            className={`p-1 ${bgClasses.hover} rounded-md transition-colors`}
            onClick={() => setIsMinimized(true)}
          >
            <X size={18} className={textClasses.secondary} />
          </button>
        </div>
      </div>

      <div
        className={`flex-1 overflow-y-auto scrollbar-hide ${bgClasses.secondary} p-2`}
      >
        <AnimatePresence>
          {activities.map((activity) => (
            <motion.div
              key={activity.id}
              className={`flex items-center p-3 border-b ${borderClasses.secondary}`}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full overflow-hidden mr-3">
                  <img
                    src={activity.avatar || "/placeholder.svg"}
                    alt={activity.username}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="w-10 h-10 rounded-full overflow-hidden mr-3">
                  <img
                    src="/placeholder.svg?height=40&width=40"
                    alt="Creator"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              <div className="flex-1">
                <div className={`font-medium ${textClasses.primary}`}>
                  {activity.username}
                </div>
                <div className={`text-sm ${textClasses.tertiary}`}>
                  followed you
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
