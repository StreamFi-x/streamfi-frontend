"use client";

import type React from "react";

import { useEffect, useState, useRef } from "react";
import { MdClose } from "react-icons/md";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";

interface ConnectModalProps {
  isModalOpen: boolean;
  setIsModalOpen: (isModalOpen: boolean) => void;
}

interface WalletInfo {
  id: string;
  name: string;
  icon?: string;
  installUrl?: string;
  description: string;
}
 
const STELLAR_WALLETS: WalletInfo[] = [
  {
    id: "freighter",
    name: "Freighter",
    description: "Browser extension",
    installUrl: "https://freighter.app/",
  },
  {
    id: "xbull",
    name: "xBull",
    description: "Browser extension + PWA",
    installUrl: "https://xbull.app/",
  },
  {
    id: "albedo",
    name: "Albedo",
    description: "Web-based (no install needed)",
    installUrl: "https://albedo.link/",
  },
  {
    id: "lobstr",
    name: "Lobstr",
    description: "Mobile + web",
    installUrl: "https://lobstr.co/",
  },
  {
    id: "hana",
    name: "Hana",
    description: "Browser extension",
    installUrl: "https://hanawallet.app/",
  },
  {
    id: "hot",
    name: "Hot Wallet",
    description: "Browser extension",
    installUrl: "https://hotwallet.app/",
  },
];

export default function ConnectWalletModal({
  isModalOpen,
  setIsModalOpen,
}: ConnectModalProps) {
  const {
    isConnected,
    isLoading,
    isConnecting,
    connectWallet,
    error: walletError,
    kit,
  } = useStellarWallet();
  const [dismissed, setDismissed] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [connectingWalletId, setConnectingWalletId] = useState<string | null>(
    null
  );
  const [walletAvailability, setWalletAvailability] = useState<
    Record<string, boolean>
  >({});
  const hasOpened = useRef(false);

  // Don't pre-check availability - let connection attempt determine it
  // This avoids false negatives where wallet is installed but detection fails
  useEffect(() => {
    if (!isModalOpen) return;
    
    // Reset availability to all true - connection will determine actual availability
    const availability: Record<string, boolean> = {};
    for (const wallet of STELLAR_WALLETS) {
      availability[wallet.id] = true;
    }
    setWalletAvailability(availability);
  }, [isModalOpen]);

  useEffect(() => {
    if (isConnected && isModalOpen) {
      setIsModalOpen(false);
      setDismissed(false);
      setShowConfirm(false);
      setSelectedWallet(null);
      setConnectingWalletId(null);
      hasOpened.current = false;
    }
  }, [isConnected, isModalOpen, setIsModalOpen]);

  useEffect(() => {
    if (hasOpened.current && !isLoading && !isConnecting && !isConnected) {
      setDismissed(true);
      hasOpened.current = false;
      setConnectingWalletId(null);
    }
  }, [isLoading, isConnecting, isConnected]);

  useEffect(() => {
    if (!isModalOpen) {
      setDismissed(false);
      setShowConfirm(false);
      setSelectedWallet(null);
      setConnectingWalletId(null);
      hasOpened.current = false;
    }
  }, [isModalOpen]);

  const handleWalletClick = async (walletId: string) => {
    setDismissed(false);
    setShowConfirm(false);
    setSelectedWallet(walletId);
    setConnectingWalletId(walletId);
    hasOpened.current = true;
    
    try {
      await connectWallet(walletId);
    } catch (err) {
      console.error("Wallet connection error:", err);
      setConnectingWalletId(null);
    }
  };

  const handleInstallClick = (wallet: WalletInfo) => {
    if (wallet.installUrl) {
      window.open(wallet.installUrl, "_blank", "noopener,noreferrer");
    }
  };

  const requestClose = () => {
    if (isLoading || isConnecting) {
      return;
    }
    if (!isConnected) {
      setShowConfirm(true);
    } else {
      setIsModalOpen(false);
    }
  };

  const confirmClose = () => {
    setShowConfirm(false);
    setIsModalOpen(false);
  };

  const cancelClose = () => {
    setShowConfirm(false);
  };

  const handleOverlayClick = () => {
    requestClose();
  };

  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className={`fixed inset-0 bg-black/40 z-[100] flex items-center justify-center px-4 ${
        isModalOpen ? "visible" : "hidden"
      }`}
      onClick={handleOverlayClick}
    >
      <div
        className="relative w-full max-w-[400px] mx-auto bg-[#1D2027] rounded-[16px] py-4 px-[26px] min-h-[200px] flex flex-col"
        onClick={handleModalClick}
      >
        <button
          className={`absolute top-4 right-4 text-white hover:text-gray-300 transition-colors rounded-full bg-[#383838] w-[30px] h-[30px] justify-center items-center flex ${
            isLoading || isConnecting ? "opacity-50 cursor-not-allowed" : ""
          }`}
          onClick={requestClose}
          disabled={isLoading || isConnecting}
        >
          <MdClose size={20} />
        </button>

        {showConfirm ? (
          <>
            <h2 className="text-white text-lg font-semibold mb-2 text-center mt-2">
              Leave without connecting?
            </h2>
            <p className="text-[14px] text-white/60 text-center mb-6">
              You haven&apos;t selected a wallet yet. Are you sure you want to
              close?
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={cancelClose}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
              >
                Go Back
              </button>
              <button
                onClick={confirmClose}
                className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium py-2.5 rounded-xl transition-colors text-sm"
              >
                Yes, Close
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-white text-lg font-semibold mt-0.5 mb-2 text-center">
              {isConnecting ? "Connecting..." : "Connect wallet"}
            </h2>

            {dismissed && !isLoading && !isConnecting && !walletError && (
              <div className="mb-4 p-3 bg-yellow-500/15 border border-yellow-500/30 rounded-lg w-full">
                <p className="text-yellow-400 text-sm text-center">
                  No wallet was selected. Please try again.
                </p>
              </div>
            )}

            {walletError && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg w-full">
                <p className="text-red-400 text-sm text-center mb-2">
                  {walletError}
                </p>
                {(walletError.includes("not installed") || 
                  walletError.includes("not found") ||
                  walletError.includes("extension")) && 
                  selectedWallet && (
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={() => {
                        const wallet = STELLAR_WALLETS.find(
                          w => w.id === selectedWallet
                        );
                        if (wallet) handleInstallClick(wallet);
                      }}
                      className="text-red-400 text-xs underline hover:text-red-300"
                    >
                      Install {STELLAR_WALLETS.find(w => w.id === selectedWallet)?.name}
                    </button>
                    <p className="text-white/40 text-xs text-center">
                      After installing, refresh the page and try again
                    </p>
                  </div>
                )}
              </div>
            )}

            <p className="font-medium text-[14px] text-white mt-2 mb-4 text-center opacity-60">
              {isConnecting
                ? "Please approve the connection in your wallet"
                : "Select a wallet to connect"}
            </p>

            {isConnecting && (
              <div className="flex justify-center mb-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              </div>
            )}

            {!isConnecting && !isConnected && (
              <div className="space-y-2 mb-4 max-h-[400px] overflow-y-auto scrollbar-hide pr-1">
                {STELLAR_WALLETS.map(wallet => {
                  const isConnectingThis = connectingWalletId === wallet.id;

                  return (
                    <button
                      key={wallet.id}
                      onClick={() => {
                        // Always try to connect - let the connection attempt determine if wallet is installed
                        handleWalletClick(wallet.id);
                      }}
                      disabled={isConnectingThis}
                      className={`w-full flex items-center justify-between p-4 rounded-xl transition-colors text-left ${
                        isConnectingThis
                          ? "bg-white/20 cursor-wait"
                          : "bg-white/10 hover:bg-white/20 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">
                            {wallet.name.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium text-sm">
                              {wallet.name}
                            </span>
                          </div>
                          <p className="text-white/50 text-xs mt-0.5">
                            {wallet.description}
                          </p>
                        </div>
                      </div>
                      {isConnectingThis && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <p className="text-[#FFFFFF99] font-[400] text-center text-xs mt-4">
              By continuing, you agree to our{" "}
              <a href="#" className="text-white underline underline-offset-1">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="text-white underline underline-offset-1">
                Privacy policy
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
