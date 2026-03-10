"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Settings, User, Wallet } from "lucide-react";
import { useState, useEffect, type ElementType } from "react";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import ConnectModal from "../connectWallet";
import { useUserProfile } from "@/hooks/useUserProfile";

interface QuickActionItem {
  icon: ElementType;
  label: string;
  href: string;
  type: "link" | "action";
}

export default function QuickActions() {
  const pathname = usePathname();
  const { publicKey: address, isConnected } = useStellarWallet();
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Defer auth-dependent rendering until after hydration to avoid server/client mismatch.
  // The wallet context reads localStorage on the client but returns null on the server,
  // which causes isConnected to differ between SSR and first client render.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Use SWR hook for optimized data fetching with caching
  const { user } = useUserProfile(address ?? undefined);
  const username = user?.username || "";

  // Before mount, treat as disconnected so SSR and client first-render agree
  const effectivelyConnected = mounted && isConnected;

  const handleConnectWallet = () => {
    setIsModalOpen(true);
  };

  // Close modal automatically once the wallet connects
  useEffect(() => {
    if (isConnected) {
      setIsModalOpen(false);
    }
  }, [isConnected]);

  const excludedRoutes = ["/", "/api", "/admin", "/dashboard"];

  const shouldShowQuickActions = !excludedRoutes.some(
    route => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (!shouldShowQuickActions) {
    return null;
  }

  // ✅ Conditional rendering: profile action when connected, connect action when not
  const quickActionItems: QuickActionItem[] = [
    { icon: Home, label: "Home", href: "/explore", type: "link" },
    { icon: Search, label: "Search", href: "/browse", type: "link" },
    { icon: Settings, label: "Settings", href: "/settings", type: "link" },
    effectivelyConnected && address
      ? {
          icon: User,
          label: "Profile",
          href: username ? `/${username}` : "/profile",
          type: "link",
        }
      : { icon: Wallet, label: "Connect", href: "#", type: "action" },
  ];

  return (
    <>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="lg:hidden absolute bottom-0 left-0 right-0 z-[80] bg-background/90 backdrop-blur-lg border-t border-border"
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
                  className="flex flex-col items-center justify-center p-3 rounded-lg transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-muted"
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
                className={`flex flex-col items-center justify-center p-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? "text-foreground bg-muted"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
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
