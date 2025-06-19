"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info, X } from "lucide-react";
import {
  bgClasses,
  textClasses,
  borderClasses,
  buttonClasses,
} from "@/lib/theme-classes";

interface StreamInfoProps {
  data: {
    title: string;
    description: string;
    tags: string[];
    thumbnail?: string;
  };
  onEditClick: () => void;
}

export default function StreamInfo({ data, onEditClick }: StreamInfoProps) {
  const { title, description, tags, thumbnail } = data;
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <AnimatePresence mode="wait">
      {isMinimized ? (
        <motion.div
          key="minimized"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="p-2"
        >
          <button
            onClick={() => setIsMinimized(false)}
            className={`flex items-center space-x-2 ${textClasses.tertiary} hover:${textClasses.primary} transition-colors`}
          >
            <Info size={18} />
            <span>Show Stream Info</span>
          </button>
        </motion.div>
      ) : (
        <motion.div
          key="expanded"
          className="flex flex-col h-full rounded-md overflow-hidden"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <div
            className={`${bgClasses.card} p-2 flex justify-between items-center border-b ${borderClasses.primary}`}
          >
            <div className="flex items-center">
              <Info size={18} className={`mr-2 ${textClasses.primary}`} />
              <span className={textClasses.primary}>Stream Info</span>
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
            className={`flex-1 overflow-y-auto scrollbar-hide ${bgClasses.secondary} p-3`}
          >
            <div className="flex mb-3">
              <div className="w-16 h-16 rounded-md overflow-hidden mr-3">
                <img
                  src={thumbnail || "/placeholder.svg"}
                  alt="Stream thumbnail"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <h3 className={`font-medium text-lg ${textClasses.primary}`}>
                  {title}
                </h3>
                <p className={`text-sm ${textClasses.tertiary} line-clamp-1`}>
                  {description}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className={`px-2 py-1 ${bgClasses.card} rounded-md text-xs ${textClasses.secondary} border ${borderClasses.secondary}`}
                >
                  {tag}
                </span>
              ))}
            </div>

            <button
              onClick={onEditClick}
              className={`w-full py-2 ${buttonClasses.primary} ${textClasses.inverseHover} rounded-md transition-colors`}
            >
              Edit Stream Info
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
