"use client";

import type React from "react";

import Image from "next/image";
import { useState, useEffect } from "react";
import { MdClose } from "react-icons/md";
import { useConnect, useAccount } from "@starknet-react/core";

interface ConnectModalProps {
  isModalOpen: boolean;
  setIsModalOpen: (isModalOpen: boolean) => void;
}

export default function ConnectWalletModal({
  isModalOpen,
  setIsModalOpen,
}: ConnectModalProps) {
  const { connect, connectors } = useConnect();
  const { isConnected, status } = useAccount();

  const [selectedWallet, setSelectedWallet] = useState(connectors?.[0] || null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Close modal when wallet connects successfully
  useEffect(() => {
    if (isConnected && isModalOpen) {
      setIsModalOpen(false);
      setIsConnecting(false);
      setConnectionError(null);
    }
  }, [isConnected, isModalOpen, setIsModalOpen]);

  // Handle connection status changes
  useEffect(() => {
    if (status === "connecting") {
      setIsConnecting(true);
      setConnectionError(null);
    } else if (status === "disconnected" && isConnecting) {
      setIsConnecting(false);
      setConnectionError("Connection failed. Please try again.");
      console.log("[ConnectWalletModal] Disconnected, resetting state");
    }
  }, [status, isConnecting]);

  const handleOverlayClick = () => {
    if (!isConnecting) {
      setIsModalOpen(false);
      setConnectionError(null);
    }
  };

  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleWalletClick = async (wallet: (typeof connectors)[0]) => {
    if (isConnecting) return;

    try {
      setSelectedWallet(wallet);
      setIsConnecting(true);
      setConnectionError(null);

      await connect({ connector: wallet });
      
      // The AuthProvider will automatically detect and store the active connector
    } catch (error) {
      console.error("[ConnectWalletModal] Connection error:", error);
      setConnectionError("Failed to connect wallet. Please try again.");
      setIsConnecting(false);
    }
  };

  const handleCloseModal = () => {
    if (!isConnecting) {
      setIsModalOpen(false);
      setConnectionError(null);
    }
  };

  return (
    <div
      className={`fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4 ${
        isModalOpen ? "visible" : "hidden"
      }`}
      onClick={handleOverlayClick}
    >
      <div
        className="relative w-full max-w-[329px] mx-auto bg-[#1D2027] rounded-[16px] py-4 px-[26px] min-h-[308px]"
        onClick={handleModalClick}
      >
        {/* Close Button */}
        <button
          className={`absolute top-4 right-4 text-white hover:text-gray-300 transition-colors rounded-full bg-[#383838] w-[30px] h-[30px] justify-center items-center flex ${
            isConnecting ? "opacity-50 cursor-not-allowed" : ""
          }`}
          onClick={handleCloseModal}
          disabled={isConnecting}
        >
          <MdClose size={20} />
        </button>

        {/* Title */}
        <h2 className="text-white text-lg font-semibold mt-0.5 mb-2 text-center">
          {isConnecting ? "Connecting..." : "Connect wallet"}
        </h2>

        {/* Subtitle */}
        <p className="font-medium text-[14px] text-white mt-2 mb-[32px] text-center justify-center opacity-60">
          {isConnecting
            ? "Please approve the connection in your wallet"
            : "Authenticate using your preferred wallet to access dApp features"}
        </p>

        {/* Connection Error */}
        {connectionError && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm text-center">
              {connectionError}
            </p>
          </div>
        )}

        {/* Wallet List */}
        <div className="flex flex-row gap-[7px] rounded-[20px] bg-[#FFFFFF1A] p-[10px] justify-center mb-4">
          {connectors.map((wallet) => (
            <div key={wallet.id} onClick={() => handleWalletClick(wallet)}>
              <button
                className={`w-[80px] h-[80px] bg-[#1D2027] rounded-[16px] flex items-center justify-center p-3 text-white transition-all duration-200 ${
                  isConnecting && selectedWallet?.id === wallet.id
                    ? "bg-[#393B3D] opacity-75 cursor-not-allowed animate-pulse"
                    : isConnecting
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-[#393B3D] cursor-pointer"
                }`}
                disabled={isConnecting}
              >
                <Image
                  src={
                    typeof wallet.icon === "object"
                      ? wallet.icon.dark || wallet.icon.light
                      : wallet.icon
                  }
                  alt={wallet.name || "Unknown Wallet"}
                  height={40}
                  width={40}
                  className="object-contain"
                />
              </button>
            </div>
          ))}
        </div>

        {/* Loading indicator */}
        {isConnecting && (
          <div className="flex justify-center mb-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
          </div>
        )}

        {/* Terms */}
        <p className="text-[#FFFFFF99] font-[400] text-center text-sm">
          By continuing, you agree to our{" "}
          <a href="#" className="text-white underline underline-offset-1">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="#" className="text-white underline underline-offset-1">
            Privacy policy
          </a>
        </p>
      </div>
    </div>
  );
}
