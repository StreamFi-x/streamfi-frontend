"use client";

import type React from "react";

import { useEffect, useState, useRef } from "react";
import { MdClose } from "react-icons/md";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";

interface ConnectModalProps {
  isModalOpen: boolean;
  setIsModalOpen: (isModalOpen: boolean) => void;
}

export default function ConnectWalletModal({
  isModalOpen,
  setIsModalOpen,
}: ConnectModalProps) {
  const { isConnected, isLoading, connect, error: walletError } =
    useStellarWallet();
  const [dismissed, setDismissed] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const hasOpened = useRef(false);

  useEffect(() => {
    if (isConnected && isModalOpen) {
      setIsModalOpen(false);
      setDismissed(false);
      setShowConfirm(false);
      hasOpened.current = false;
    }
  }, [isConnected, isModalOpen, setIsModalOpen]);

  useEffect(() => {
    if (hasOpened.current && !isLoading && !isConnected) {
      setDismissed(true);
      hasOpened.current = false;
    }
  }, [isLoading, isConnected]);

  useEffect(() => {
    if (!isModalOpen) {
      setDismissed(false);
      setShowConfirm(false);
      hasOpened.current = false;
    }
  }, [isModalOpen]);

  const handleConnect = async () => {
    setDismissed(false);
    setShowConfirm(false);
    hasOpened.current = true;
    await connect();
  };

  const requestClose = () => {
    if (isLoading) {
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
      className={`fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4 ${
        isModalOpen ? "visible" : "hidden"
      }`}
      onClick={handleOverlayClick}
    >
      <div
        className="relative w-full max-w-[329px] mx-auto bg-[#1D2027] rounded-[16px] py-4 px-[26px] min-h-[200px] flex flex-col items-center justify-center"
        onClick={handleModalClick}
      >
        <button
          className={`absolute top-4 right-4 text-white hover:text-gray-300 transition-colors rounded-full bg-[#383838] w-[30px] h-[30px] justify-center items-center flex ${
            isLoading ? "opacity-50 cursor-not-allowed" : ""
          }`}
          onClick={requestClose}
          disabled={isLoading}
        >
          <MdClose size={20} />
        </button>

        {showConfirm ? (
          <>
            <h2 className="text-white text-lg font-semibold mb-2 text-center">
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
              {isLoading ? "Connecting..." : "Connect wallet"}
            </h2>

            {dismissed && !isLoading && !walletError && (
              <div className="mb-4 p-3 bg-yellow-500/15 border border-yellow-500/30 rounded-lg w-full">
                <p className="text-yellow-400 text-sm text-center">
                  No wallet was selected. Please try again.
                </p>
              </div>
            )}

            {walletError && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg w-full">
                <p className="text-red-400 text-sm text-center">{walletError}</p>
              </div>
            )}

            <p className="font-medium text-[14px] text-white mt-2 mb-6 text-center opacity-60">
              {isLoading
                ? "Please approve the connection in your wallet"
                : "Authenticate using your preferred wallet to access dApp features"}
            </p>

            {isLoading && (
              <div className="flex justify-center mb-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              </div>
            )}

            {!isLoading && !isConnected && (
              <button
                onClick={handleConnect}
                className="bg-white/10 hover:bg-white/20 text-white font-medium py-3 px-6 rounded-xl transition-colors"
              >
                {dismissed ? "Try Again" : "Choose Wallet"}
              </button>
            )}

            <p className="text-[#FFFFFF99] font-[400] text-center text-sm mt-6">
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
