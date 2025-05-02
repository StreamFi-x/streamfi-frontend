"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, Maximize } from "lucide-react";

export default function StreamPreview() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <motion.div
      className="h-full flex flex-col rounded-md w-full max-w-xl overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="bg-gray-800 p-2 flex justify-between items-center">
        <div className="flex items-center">
          <MonitorIcon size={18} className="mr-2" />
          <span>Stream Preview</span>
        </div>
        <div className="flex space-x-2">
          <button className="p-1 hover:bg-gray-700 rounded-md transition-colors">
            <Settings size={18} />
          </button>
          <button
            className="p-1 hover:bg-gray-700 rounded-md transition-colors"
            onClick={toggleFullscreen}
          >
            <Maximize size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-xl bg-black relative">
        <div className="absolute inset-0 flex items-center justify-center">
          {isStreaming ? (
            <video
              className="w-full h-full object-contain"
              autoPlay
              muted
              playsInline
            >
              <source src="/placeholder-video.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          ) : (
            <>
              <img
                src="/Images/stream-preview.png"
                alt="Stream preview"
                className="max-w-xl max-h-full object-contain"
              />
              <div className="absolute top-4 left-4 bg-red-600 px-2 py-1 text-xs font-semibold rounded">
                OFFLINE
              </div>
            </>
          )}
        </div>
        <div className="absolute bottom-4 right-4 flex space-x-2">
          <button className="bg-gray-800 bg-opacity-70 p-2 rounded-md hover:bg-opacity-100 transition-colors">
            <Settings size={18} />
          </button>
        </div>
      </div>
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
