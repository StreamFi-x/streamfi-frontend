"use client";

import type React from "react";

import Image from "next/image";
import { useState, useEffect } from "react";
import { MdClose } from "react-icons/md";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import {
  FREIGHTER_ID,
  xBULL_ID,
  ALBEDO_ID,
  LOBSTR_ID,
  HANA_ID,
} from "@creit.tech/stellar-wallets-kit";

interface ConnectModalProps {
  isModalOpen: boolean;
  setIsModalOpen: (isModalOpen: boolean) => void;
}

interface StellarWallet {
  id: string;
  name: string;
  icon: string;
  installUrl?: string;
}

// Stellar wallet configurations
const STELLAR_WALLETS: StellarWallet[] = [
  {
    id: FREIGHTER_ID,
    name: "Freighter",
    icon: "/wallets/freighter.svg",
    installUrl:
      "https://chrome.google.com/webstore/detail/freighter/bcacfldlkkdogcmkkibnjlakofdplcbk",
  },
  {
    id: xBULL_ID,
    name: "xBull",
    icon: "/wallets/xbull.svg",
    installUrl: "https://xbull.app/",
  },
  {
    id: ALBEDO_ID,
    name: "Albedo",
    icon: "/wallets/albedo.svg",
    installUrl: "https://albedo.link/",
  },
  {
    id: LOBSTR_ID,
    name: "Lobstr",
    icon: "/wallets/lobstr.svg",
    installUrl: "https://lobstr.co/",
  },
  {
    id: HANA_ID,
    name: "Hana",
    icon: "/wallets/hana.svg",
    installUrl: "https://hanawallet.io/",
  },
];

export default function ConnectWalletModal({
  isModalOpen,
  setIsModalOpen,
}: ConnectModalProps) {
  const { isConnected, isConnecting, error, connectWallet } =
    useStellarWallet();

  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Close modal when wallet connects successfully
  useEffect(() => {
    if (isConnected && isModalOpen) {
      setIsModalOpen(false);
      setSelectedWallet(null);
      setConnectionError(null);
    }
  }, [isConnected, isModalOpen, setIsModalOpen]);

  // Update connection error from context
  useEffect(() => {
    if (error) {
      setConnectionError(error);
    }
  }, [error]);

  const handleOverlayClick = () => {
    if (!isConnecting) {
      setIsModalOpen(false);
      setConnectionError(null);
      setSelectedWallet(null);
    }
  };

  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleWalletClick = async (wallet: StellarWallet) => {
    if (isConnecting) {
      return;
    }

    try {
      setSelectedWallet(wallet.id);
      setConnectionError(null);

      await connectWallet(wallet.id);
    } catch (err) {
      console.error("[ConnectWalletModal] Connection error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to connect wallet";

      // Check if wallet is not installed
      if (
        errorMessage.includes("not installed") ||
        errorMessage.includes("not found") ||
        errorMessage.includes("not available")
      ) {
        setConnectionError(
          `${wallet.name} is not installed. Please install it first.`
        );
      } else if (
        errorMessage.includes("rejected") ||
        errorMessage.includes("denied")
      ) {
        setConnectionError("Connection rejected. Please try again.");
      } else {
        setConnectionError(errorMessage);
      }

      setSelectedWallet(null);
    }
  };

  const handleCloseModal = () => {
    if (!isConnecting) {
      setIsModalOpen(false);
      setConnectionError(null);
      setSelectedWallet(null);
    }
  };

  const getInstallLink = (walletId: string) => {
    const wallet = STELLAR_WALLETS.find(w => w.id === walletId);
    return wallet?.installUrl;
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
            {connectionError.includes("not installed") && selectedWallet && (
              <a
                href={getInstallLink(selectedWallet)}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-2 text-center text-blue-400 hover:text-blue-300 text-sm underline"
              >
                Install Wallet
              </a>
            )}
          </div>
        )}

        {/* Wallet List */}
        <div className="flex flex-row gap-[7px] rounded-[20px] bg-[#FFFFFF1A] p-[10px] justify-center mb-4 flex-wrap">
          {STELLAR_WALLETS.map(wallet => (
            <div key={wallet.id} onClick={() => handleWalletClick(wallet)}>
              <button
                className={`w-[80px] h-[80px] bg-[#1D2027] rounded-[16px] flex flex-col items-center justify-center p-2 text-white transition-all duration-200 ${
                  isConnecting && selectedWallet === wallet.id
                    ? "bg-[#393B3D] opacity-75 cursor-not-allowed animate-pulse"
                    : isConnecting
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-[#393B3D] cursor-pointer"
                }`}
                disabled={isConnecting}
                title={wallet.name}
              >
                <div className="w-10 h-10 mb-1 flex items-center justify-center">
                  <Image
                    src={wallet.icon}
                    alt={wallet.name}
                    height={40}
                    width={40}
                    className="object-contain"
                  />
                </div>
                <span className="text-xs text-center truncate w-full">
                  {wallet.name}
                </span>
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
