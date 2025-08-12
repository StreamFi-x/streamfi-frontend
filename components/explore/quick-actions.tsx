"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Settings, User, Wallet } from "lucide-react";
import { useAccount } from "@starknet-react/core";
import { useState, useEffect, useCallback } from "react";
import ConnectModal from "../connectWallet";
import { bgClasses, buttonClasses, textClasses } from "@/lib/theme-classes";

interface QuickActionItem {
  icon: React.ElementType;
  label: string;
  href: string;
  type: "link" | "action";
}

export default function QuickActions() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [username, setUsername] = useState("");

  const handleConnectWallet = () => {
    setIsModalOpen(true);
  };
  const handleProfileDisplayModal = useCallback(() => {
    if (!address) return;

    fetch(`/api/users/wallet/${address}`)
      .then(async (res) => {
        if (res.ok) {
          const result = await res.json();
          setUsername(result.user.username);
        }
      })
      .catch((reason) => {
        console.log("Error finding user ", reason);
      });
  }, [address]);
  useEffect(() => {
    if (isConnected) {
      setIsModalOpen(false);
    }
  }, [isConnected]);
  useEffect(() => {
    if (isConnected && address) {
      handleProfileDisplayModal();
    }
  }, [address, handleProfileDisplayModal, isConnected]);
  // const allowedRoutes = [
  //   "/explore",
  //   "/settings",
  //   "/browse",
  //   username ? `/${username}` : "/profile",
  // ];

  // const shouldShowQuickActions = allowedRoutes.some(
  //   (route) => pathname === route || pathname.startsWith(`${route}/`)
  // );

  const excludedRoutes = ["/", "/api", "/admin", "/dashboard"];

const shouldShowQuickActions = !excludedRoutes.some(
  (route) =>
    pathname === route ||
    pathname.startsWith(`${route}/`)
);

if (!shouldShowQuickActions) return null;
  const quickActionItems: QuickActionItem[] = [
    { icon: Home, label: "Home", href: "/explore", type: "link" },
    { icon: Search, label: "Search", href: "/browse", type: "link" },
    { icon: Settings, label: "Settings", href: "/settings", type: "link" },
    isConnected && address
      ? {
          icon: User,
          label: "Profile",
          href: username ? `/${username}` : "/profile",
          type: "link",
        }
      : { icon: Wallet, label: "Connect", href: "#", type: "action" },
  ];

  if (!shouldShowQuickActions) return null;

  return (
    <>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="lg:hidden absolute bottom-0 left-0 right-0 z-[80]  backdrop-blur-lg border-t border-white/10"
      >
        <div className="flex items-center justify-around py-2 px-4 safe-area-pb">
          {quickActionItems.map((item, index) => {
            const isActive =
              item.type === "link" &&
              (pathname === item.href || pathname.startsWith(`${item.href}/`));
            if (item.type === "action") {
              return (
                <button
                  key={`${item.label}-${index}`}
                  onClick={handleConnectWallet}
                  className="flex flex-col items-center justify-center p-3 rounded-lg transition-all duration-200  hover:text-white hover:bg-[#2D2F31]/40"
                >
                  <item.icon size={20} className="mb-1" />
                  <span className="text-xs font-medium">{item.label}</span>
                </button>
              );
            }

            return (
              <Link
                key={`${item.label}-${index}`}
                href={item.href}
                className={`flex flex-col items-center justify-center p-3 rounded-lg transition-all duration-200 ${buttonClasses} ${
                  isActive
                    ? `${textClasses.primary} ${bgClasses.primary}`
                    : "text-/60 hover:text-white hover:bg-[#2D2F31]/40"
                }`}
              >
                <item.icon size={20} className="mb-1" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </motion.div>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black opacity-50"
              onClick={() => setIsModalOpen(false)}
            />
            =
            <motion.div className="bg-background p-6 rounded-md z-10">
              <ConnectModal
                isModalOpen={isModalOpen}
                setIsModalOpen={setIsModalOpen}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
