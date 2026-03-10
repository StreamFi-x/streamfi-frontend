"use client";

import type React from "react";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ExternalLink, X } from "lucide-react";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import { usePrivyAuth } from "@/hooks/usePrivyAuth";

interface ConnectModalProps {
  isModalOpen: boolean;
  setIsModalOpen: (isModalOpen: boolean) => void;
}

interface WalletInfo {
  id: string;
  name: string;
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
    description: "Web-based · no install needed",
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
  } = useStellarWallet();
  const { signInWithGoogle, ready: privyReady, authenticated: privyAuthenticated } = usePrivyAuth();
  const router = useRouter();

  const [dismissed, setDismissed] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [connectingWalletId, setConnectingWalletId] = useState<string | null>(null);
  const hasOpened = useRef(false);

  useEffect(() => {
    // Auto-close if user is already authenticated (Stellar wallet or Privy Google)
    if (isModalOpen && (isConnected || privyAuthenticated)) {
      setIsModalOpen(false);
      router.push("/explore");
    }
  }, [isConnected, privyAuthenticated, isModalOpen, setIsModalOpen, router]);

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
    } catch {
      setConnectingWalletId(null);
    }
  };

  const requestClose = () => {
    if (isLoading || isConnecting) {return;}
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

  const cancelClose = () => setShowConfirm(false);

  const handleOverlayClick = () => requestClose();
  const handleModalClick = (e: React.MouseEvent) => e.stopPropagation();

  const selectedWalletInfo = STELLAR_WALLETS.find(w => w.id === selectedWallet);
  const showInstallLink =
    walletError &&
    (walletError.includes("not installed") ||
      walletError.includes("not found") ||
      walletError.includes("extension")) &&
    selectedWalletInfo?.installUrl;

  if (!isModalOpen) {return null;}

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={handleOverlayClick}
    >
      <div
        className="relative w-full sm:max-w-[420px] bg-[#111114] rounded-t-2xl sm:rounded-2xl border border-white/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
        onClick={handleModalClick}
      >
        {/* Drag handle (mobile only) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-white/[0.12] rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-4 sm:pt-5 pb-0">
          <div>
            <h2 className="text-white text-[17px] font-semibold leading-snug">
              Connect to StreamFi
            </h2>
            <p className="text-white/35 text-[13px] mt-0.5">
              Sign in with Google or a Stellar wallet
            </p>
          </div>
          <button
            onClick={requestClose}
            disabled={isLoading || isConnecting}
            className="text-white/40 hover:text-white bg-white/[0.06] hover:bg-white/[0.10] rounded-full w-8 h-8 flex items-center justify-center transition-all flex-shrink-0 ml-3 mt-0.5 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pt-4 pb-5 space-y-3">

          {/* — Confirm-close screen — */}
          {showConfirm ? (
            <div className="py-2 space-y-4">
              <p className="text-white/60 text-sm text-center leading-relaxed">
                You haven&apos;t connected yet. Are you sure you want to close?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={cancelClose}
                  className="flex-1 bg-white/[0.07] hover:bg-white/[0.11] text-white/80 hover:text-white text-sm font-medium py-2.5 rounded-xl transition-all"
                >
                  Go back
                </button>
                <button
                  onClick={confirmClose}
                  className="flex-1 bg-red-500/[0.12] hover:bg-red-500/[0.20] text-red-400 hover:text-red-300 text-sm font-medium py-2.5 rounded-xl transition-all"
                >
                  Yes, close
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Google — primary CTA */}
              {!isConnecting && (
                <button
                  onClick={() => {
                    if (privyAuthenticated) {
                      setIsModalOpen(false);
                      router.push("/explore");
                    } else {
                      signInWithGoogle();
                    }
                  }}
                  disabled={!privyReady}
                  className="flex items-center justify-center gap-2.5 w-full py-3 px-4 bg-white hover:bg-white/[0.92] text-[#111] text-sm font-semibold rounded-xl transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
                    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
                  </svg>
                  Continue with Google
                </button>
              )}

              {/* Divider */}
              {!isConnecting && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/[0.07]" />
                  <span className="text-white/20 text-xs font-medium tracking-wide">
                    or connect wallet
                  </span>
                  <div className="flex-1 h-px bg-white/[0.07]" />
                </div>
              )}

              {/* Connecting state */}
              {isConnecting && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-10 h-10 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
                  <p className="text-white/50 text-sm">
                    Approve the connection in your wallet
                  </p>
                </div>
              )}

              {/* Error alert */}
              {walletError && (
                <div className="flex items-start gap-2.5 p-3 bg-red-500/[0.08] border border-red-500/[0.18] rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-red-400 text-xs leading-relaxed">{walletError}</p>
                    {showInstallLink && (
                      <a
                        href={selectedWalletInfo!.installUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1.5 text-red-400/70 hover:text-red-300 text-xs underline underline-offset-2 transition-colors"
                      >
                        Install {selectedWalletInfo!.name}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Dismissed (no wallet selected) */}
              {dismissed && !isLoading && !isConnecting && !walletError && (
                <div className="flex items-center gap-2.5 p-3 bg-yellow-500/[0.08] border border-yellow-500/[0.18] rounded-xl">
                  <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  <p className="text-yellow-400 text-xs">
                    No wallet was selected. Please try again.
                  </p>
                </div>
              )}

              {/* Wallet list */}
              {!isConnecting && (
                <div className="space-y-1.5">
                  {STELLAR_WALLETS.map(wallet => {
                    const isConnectingThis = connectingWalletId === wallet.id;
                    return (
                      <button
                        key={wallet.id}
                        onClick={() => handleWalletClick(wallet.id)}
                        disabled={isConnectingThis}
                        className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] transition-all text-left group disabled:cursor-wait"
                      >
                        {/* Wallet initial avatar */}
                        <div className="w-9 h-9 rounded-lg bg-white/[0.07] flex items-center justify-center flex-shrink-0">
                          <span className="text-white/70 font-semibold text-sm group-hover:text-white/90 transition-colors">
                            {wallet.name.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white/85 text-sm font-medium leading-none mb-1 group-hover:text-white transition-colors">
                            {wallet.name}
                          </p>
                          <p className="text-white/30 text-xs">{wallet.description}</p>
                        </div>
                        {isConnectingThis && (
                          <div className="w-4 h-4 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Terms */}
              <p className="text-white/20 text-[11px] text-center pt-0.5 leading-relaxed">
                By continuing you agree to our{" "}
                <a href="#" className="text-white/35 hover:text-white/55 underline underline-offset-2 transition-colors">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="text-white/35 hover:text-white/55 underline underline-offset-2 transition-colors">
                  Privacy Policy
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
