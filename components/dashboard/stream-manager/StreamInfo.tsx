"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info, X } from "lucide-react";

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
            className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors"
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
          <div className="bg-card p-2 flex justify-between items-center border-b text-sm border-border">
            <div className="flex items-center">
              <Info size={18} className="mr-2 text-foreground" />
              <span className="text-foreground">Stream Info</span>
            </div>
            <div className="flex space-x-2">
              <button
                className="p-1 hover:bg-surface-hover rounded-md transition-colors"
                onClick={() => setIsMinimized(true)}
              >
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide bg-background p-3">
            <div className="flex mb-3">
              <div className="w-12 h-12 rounded-md overflow-hidden mr-3">
                <img
                  src={thumbnail || "/placeholder.svg"}
                  alt="Stream thumbnail"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {description}
                </p>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {tags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-card rounded-md text-xs text-muted-foreground border border-border"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={onEditClick}
              className="w-full py-2 bg-highlight hover:bg-highlight/80 text-primary-foreground text-xs rounded-md transition-colors"
            >
              Edit Stream Info
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
