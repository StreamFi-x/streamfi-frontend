"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, X, Copy } from "lucide-react";
import { useRouter } from "next/navigation";

export default function StreamSettings() {
  const router = useRouter();
  const [isMinimized, setIsMinimized] = useState(false);

  const walletAddresses = {
    strk: "0x05889c1d2a5f8f47e125e339af3af05d50a",
    usdt: "TGHuV8w3ucP4QX9wTm2cvF9qAZ4r5cTo",
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        // Show a small tooltip or notification
        alert("Copied to clipboard!");
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  };

  const handleEditSettings = () => {
    router.push("/dashboard/payout");
  };

  if (isMinimized) {
    return (
      <div className="p-2">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
        >
          <Settings size={18} />
          <span>Show Stream Settings</span>
        </button>
      </div>
    );
  }

  return (
    <motion.div
      className="flex flex-col h-full rounded-md overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="bg-gray-800 p-2 flex justify-between items-center">
        <div className="flex items-center">
          <Settings size={18} className="mr-2" />
          <span>Stream Settings</span>
        </div>
        <div className="flex space-x-2">
          <button
            className="p-1 hover:bg-gray-700 rounded-md transition-colors"
            onClick={() => setIsMinimized(true)}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide bg-[#1A1A1A] p-3">
        <div className="mb-3">
          <div className="text-sm text-gray-400 mb-1">
            STRK (Starknet) Address
          </div>
          <div className="flex items-center bg-gray-800 rounded-md p-2">
            <div className="flex-1 text-xs font-mono truncate">
              {walletAddresses.strk}
            </div>
            <button
              onClick={() => copyToClipboard(walletAddresses.strk)}
              className="p-1 hover:bg-gray-700 rounded-md transition-colors ml-2"
            >
              <Copy size={16} />
            </button>
          </div>
        </div>

        <div className="mb-4">
          <div className="text-sm text-gray-400 mb-1">
            USDT (dollar) Address
          </div>
          <div className="flex items-center bg-gray-800 rounded-md p-2">
            <div className="flex-1 text-xs font-mono truncate">
              {walletAddresses.usdt}
            </div>
            <button
              onClick={() => copyToClipboard(walletAddresses.usdt)}
              className="p-1 hover:bg-gray-700 rounded-md transition-colors ml-2"
            >
              <Copy size={16} />
            </button>
          </div>
        </div>

        <button
          onClick={handleEditSettings}
          className="w-full py-2 bg-purple-600 hover:bg-purple-700 rounded-md transition-colors"
        >
          Edit Stream Settings
        </button>
      </div>
    </motion.div>
  );
}
