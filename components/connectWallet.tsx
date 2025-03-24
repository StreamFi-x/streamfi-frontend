



"use client";

import Image from "next/image";
import { useState } from "react";
import { MdClose } from "react-icons/md";
import { useConnect, useAccount } from "@starknet-react/core";

interface ConnectModalProps {
  isModalOpen: boolean;
  setIsModalOpen: (isModalOpen: boolean) => void;
}

export default function ConnectModal({
  isModalOpen,
  setIsModalOpen,
}: ConnectModalProps) {
  // StarkNet React hooks
  const { connect, connectors } = useConnect();
  const { isConnected, connector } = useAccount();

  // Local state for tracking selected wallet
  const [selectedWallet, setSelectedWallet] = useState(connectors?.[0] || null);
  const [activeWallet, setActiveWallet] = useState("argent-mobile");

  const handleOverlayClick = () => {
    setIsModalOpen(false);
  };

  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent closing modal when clicking inside
  };

  const handleWalletClick = (wallet: typeof connectors[0]) => {
    setActiveWallet(wallet.id);
    setSelectedWallet(wallet);
    // You can optionally trigger connect immediately, if desired:
    // connect({ connector: wallet });
  };

  return (
    <div
      className={`fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4 ${
        isModalOpen ? "visible" : "hidden"
      }`}
      onClick={handleOverlayClick}
    >
      {/* Modal Container */}
      <div
        className="relative w-full max-w-md bg-[#0F0F0F] rounded-[10px] p-6 h-[380px]"
        onClick={handleModalClick}
      >
        {/* Close Button */}
        <button
          className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
          onClick={() => setIsModalOpen(false)}
        >
          <MdClose size={24} />
        </button>

        {/* Title */}
        <h2 className="text-white text-xl font-semibold my-3 text-center">
          Select a wallet
        </h2>

        {/* Subtitle */}
        <p className="font-[400] text-[12px] text-white my-6 text-center justify-center">
          Securely authenticate &amp; start streaming with full ownership over
          your earnings.
        </p>

        {/* Wallet List */}
        <div className="flex flex-col space-y-2">
          {connectors.map((wallet, idx) => (
            <div key={wallet.id}
            onClick={() => {
              handleWalletClick(wallet)
              connect({wallet})
            }}
            >
              <button
                className="w-full flex items-center gap-3 p-3 text-white mb-3 hover:bg-[#393B3D] transition-colors"
              >
                <Image
                  src={
                    typeof wallet.icon === "object"
                      ? wallet.icon.dark
                      : wallet.icon
                  }
                  alt={wallet.name || "Unknown Wallet"}
                  height={24}
                  width={24}
                />
                <span className="text-sm font-medium">{wallet.name}</span>
              </button>

              {/* Divider between wallet items, except after last one */}
              {idx < connectors.length - 1 && (
                <hr className="border-t  border-[#D9D9D957]" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
