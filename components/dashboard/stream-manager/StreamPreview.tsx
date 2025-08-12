"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, Maximize } from "lucide-react";
import { bgClasses, textClasses, borderClasses } from "@/lib/theme-classes";

export default function StreamPreview() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
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
      <div
        className={`${bgClasses.card} p-2 flex justify-between items-center border-b ${borderClasses.primary}`}
      >
        <div className="flex items-center">
          <MonitorIcon size={18} className={`mr-2 ${textClasses.primary}`} />
          <span className={textClasses.primary}>Stream Preview</span>
        </div>
        <div className="flex space-x-2">
          <button
            className={`p-1 ${bgClasses.hover} rounded-md transition-colors`}
          >
            <Settings size={18} className={textClasses.secondary} />
          </button>
          <button
            className={`p-1 ${bgClasses.hover} rounded-md transition-colors`}
            onClick={toggleFullscreen}
          >
            <Maximize size={18} className={textClasses.secondary} />
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-xl w-full bg-black relative">
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
                className="object-cover"
              />
              <div className="absolute top-4 left-4 bg-red-600 px-2 py-1 text-xs font-semibold rounded text-white">
                OFFLINE
              </div>
            </>
          )}
        </div>
        <div className="absolute bottom-4 right-4 flex space-x-2">
          <button
            className={`${bgClasses.card} bg-opacity-70 p-2 rounded-md hover:bg-opacity-100 transition-colors border ${borderClasses.primary}`}
          >
            <Settings size={18} className={textClasses.primary} />
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
