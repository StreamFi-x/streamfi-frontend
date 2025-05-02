"use client";

import { motion } from "framer-motion";
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

  return (
    <motion.div
      className="flex flex-col h-full rounded-md overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="bg-gray-800 p-2 flex justify-between items-center">
        <div className="flex items-center">
          <Info size={18} className="mr-2" />
          <span>Stream Info</span>
        </div>
        <div className="flex space-x-2">
          <button className="p-1 hover:bg-gray-700 rounded-md transition-colors">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide bg-[#1A1A1A] p-3">
        <div className="flex mb-3">
          <div className="w-16 h-16 rounded-md overflow-hidden mr-3">
            <img
              src={thumbnail || "/placeholder.svg"}
              alt="Stream thumbnail"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-lg">{title}</h3>
            <p className="text-sm text-gray-400 line-clamp-1">{description}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 bg-gray-800 rounded-md text-xs"
            >
              {tag}
            </span>
          ))}
        </div>

        <button
          onClick={onEditClick}
          className="w-full py-2 bg-purple-600 hover:bg-purple-700 rounded-md transition-colors"
        >
          Edit Stream Info
        </button>
      </div>
    </motion.div>
  );
}
