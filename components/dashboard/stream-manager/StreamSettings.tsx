"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, X, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  bgClasses,
  textClasses,
  borderClasses,
  buttonClasses,
} from "@/lib/theme-classes";

export default function StreamSettings() {
  const router = useRouter();
  const [isMinimized, setIsMinimized] = useState(false);
  const [connectedWalletAddress, setConnectedWalletAddress] =
    useState<string>("");

  // Get connected wallet address from localStorage or context
  useEffect(() => {
    const storedAddress =
      localStorage.getItem("wallet") ||
      localStorage.getItem("connectedWallet") ||
      "0x05889c1d2a5f8f47e125e339af3af05d50a";
    setConnectedWalletAddress(storedAddress);
  }, []);

  const walletAddresses = {
    strk: connectedWalletAddress, // Use the actual connected wallet address
    usdt: "TGHuV8w3ucP4QX9wTm2cvF9qAZ4r5cTo8K3mN", // Random USDT address
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        // Show a small tooltip or notification
        alert("Copied to clipboard!");
      })
      .catch(err => {
        console.error("Failed to copy: ", err);
      });
  };

  const handleEditSettings = () => {
    router.push("/dashboard/payout");
  };

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
            <Settings size={18} />
            <span>Show Stream Settings</span>
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
              <Settings size={18} className={`mr-2 ${textClasses.primary}`} />
              <span className={textClasses.primary}>Stream Settings</span>
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
            className={`flex-1 overflow-y-auto scrollbar-hide ${bgClasses.primary} p-3`}
          >
            <div className="mb-3">
              <div className={`text-xs ${textClasses.tertiary} mb-1`}>
                STRK (Starknet) Address
              </div>
              <div
                className={`flex items-center ${bgClasses.secondary} rounded-md p-2 border ${borderClasses.primary}`}
              >
                <div
                  className={`flex-1 text-[10px] font-mono truncate ${textClasses.secondary}`}
                >
                  {walletAddresses.strk}
                </div>
                <button
                  onClick={() => copyToClipboard(walletAddresses.strk)}
                  className={`p-1 ${bgClasses.hover} rounded-md transition-colors ml-2`}
                >
                  <Copy size={16} className={textClasses.secondary} />
                </button>
              </div>
            </div>

            <div className="mb-4">
              <div className={`text-xs ${textClasses.tertiary} mb-1`}>
                USDT (Tether) Address
              </div>
              <div
                className={`flex items-center ${bgClasses.secondary} rounded-md p-2 border ${borderClasses.primary}`}
              >
                <div
                  className={`flex-1 text-[10px] font-mono truncate ${textClasses.secondary}`}
                >
                  {walletAddresses.usdt}
                </div>
                <button
                  onClick={() => copyToClipboard(walletAddresses.usdt)}
                  className={`p-1 ${bgClasses.hover} rounded-md transition-colors ml-2`}
                >
                  <Copy size={16} className={textClasses.secondary} />
                </button>
              </div>
            </div>

            <button
              onClick={handleEditSettings}
              className={`w-full py-2 ${buttonClasses.secondary} ${textClasses.inverseHover} text-xs rounded-md transition-colors`}
            >
              Edit Stream Settings
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
