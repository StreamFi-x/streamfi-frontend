/* eslint-disable @next/next/no-img-element */
"use client";
import { useState, useEffect, useCallback } from "react";
import { StreamfiLogoLight, StreamfiLogoShort } from "@/public/icons";
import { ChevronDown } from "lucide-react";
import NotificationBell from "@/components/shared/NotificationBell";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/auth/auth-provider";
import ConnectModal from "../connectWallet";
import ProfileModal from "./ProfileModal";
import Avatar from "@/public/Images/user.png";
import ProfileDropdown from "../ui/profileDropdown";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import { SearchBar } from "@/components/search/SearchBar";

interface NavbarProps {
  onConnectWallet?: () => void;
  toggleSidebar?: () => void;
  onConnect?: () => void;
}

export default function Navbar({}: NavbarProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { publicKey, isConnected, disconnect, privyWallet } =
    useStellarWallet();
  const { user, isLoading: authLoading, isError: authError } = useAuth();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [hasCheckedProfile, setHasCheckedProfile] = useState(false);
  const [connectStep, setConnectStep] = useState<
    "profile" | "verify" | "success"
  >("profile");
  // Always start as loading — check sessionStorage in useEffect to avoid SSR/client mismatch
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  // Prevent auth UI from rendering until after hydration (avoids SSR/localStorage mismatch)
  const [mounted, setMounted] = useState(false);

  // Authenticated = Freighter wallet connected OR Privy (Google) session active
  const isAuthenticated = isConnected || !!privyWallet;

  // safe sessionStorage parse
  const getSessionData = useCallback(<T,>(key: string): T | null => {
    if (typeof window === "undefined") {
      return null;
    }
    try {
      const data = sessionStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }, []);

  //  display name — privy user takes priority, then wallet user, then truncated key
  const getDisplayName = useCallback(() => {
    if (privyWallet?.username) {
      return privyWallet.username;
    }
    if (privyWallet?.displayName) {
      return privyWallet.displayName;
    }
    if (user?.username) {
      return user.username;
    }

    const storedUser = getSessionData<{ username?: string }>("userData");
    if (storedUser?.username) {
      return storedUser.username;
    }

    // Fallback: privy_user in sessionStorage (page refresh before event fires)
    const privyStored = getSessionData<{ username?: string }>("privy_user");
    if (privyStored?.username) {
      return privyStored.username;
    }

    if (publicKey) {
      return `${publicKey.slice(0, 6)}...${publicKey.slice(-4)}`;
    }

    return "Unknown User";
  }, [privyWallet, user?.username, publicKey, getSessionData]);

  // avatar logic — privy user takes priority
  const getAvatar = useCallback(() => {
    if (privyWallet?.avatar) {
      return privyWallet.avatar;
    }
    if (user?.avatar) {
      return user.avatar;
    }

    const storedUser = getSessionData<{ avatar?: string }>("userData");
    if (storedUser?.avatar) {
      return storedUser.avatar;
    }

    return Avatar;
  }, [privyWallet, user?.avatar, getSessionData]);

  const handleCloseProfileModal = () => {
    setProfileModalOpen(false);
    setHasCheckedProfile(true);
  };

  const handleNextStep = (step: "profile" | "verify" | "success") => {
    setConnectStep(step);
  };

  // Mark as mounted after hydration and resolve initial loading state from sessionStorage
  useEffect(() => {
    setMounted(true);
    const hasPrivySession = !!sessionStorage.getItem("privy_user");
    if (hasPrivySession) {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setHasCheckedProfile(false);
  }, [publicKey]);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        !target.closest(".profile-dropdown-container") &&
        !target.closest(".avatar-container") &&
        !target.closest("[data-search-root]")
      ) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleConnectWallet = () => {
    if (isConnected) {
      disconnect();
    } else {
      setIsModalOpen(true);
    }
  };

  const toggleProfileDropdown = () =>
    setIsProfileDropdownOpen(!isProfileDropdownOpen);

  // Profile modal logic — only for Freighter wallet users (Privy users use /onboarding page)
  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!isConnected || !publicKey || hasCheckedProfile || !!privyWallet) {
      setIsLoading(false);
      return;
    }

    if (!user) {
      if (authError) {
        // SWR fetch failed (network/5xx) — don't mark check as done so the
        // effect re-runs once SWR retries and either confirms 404 or finds the user.
        setIsLoading(false);
        return;
      }
      // Confirmed 404: user is genuinely not registered yet.
      setHasCheckedProfile(true);
      setProfileModalOpen(true);
    } else {
      setHasCheckedProfile(true);
      sessionStorage.setItem("userData", JSON.stringify(user));
      sessionStorage.setItem("username", user.username);
    }

    setIsLoading(false);
  }, [isConnected, publicKey, authLoading, authError, user, hasCheckedProfile]);

  useEffect(() => {
    if (isConnected) {
      setIsModalOpen(false);
    }
  }, [isConnected]);

  // Function to check for cloudinary URL
  const ALLOWED_CLOUDINARY_HOST = "res.cloudinary.com"; // replace with Cloudinary domain

  function isCloudinaryUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.hostname === ALLOWED_CLOUDINARY_HOST;
    } catch {
      return false;
    }
  }

  const userAvatar = getAvatar();
  const displayName = getDisplayName();

  return (
    <>
      <header className="h-20 flex items-center justify-between px-4 border-b-[0.5px] border-border bg-sidebar z-50">
        <div className="flex items-center gap-4">
          <Link href="/explore" className="flex items-center gap-2">
            <Image
              src={StreamfiLogoLight || "/Images/user.png"}
              alt="Streamfi Logo"
              className="dark:hidden"
            />
            <Image
              src={StreamfiLogoShort || "/Images/user.png"}
              alt="Streamfi Logo"
              className="hidden dark:block"
            />
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-end gap-3 md:mx-4 md:max-w-xl md:justify-center">
          <div data-search-root className="w-full max-w-xl">
            <SearchBar showMobileTrigger={true} />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {!mounted ? (
            <div className="w-24 h-9 animate-pulse bg-muted rounded-md" />
          ) : isAuthenticated ? (
            <>
              {!isLoading && <NotificationBell />}
              <div className="relative avatar-container">
                <div
                  className="cursor-pointer flex gap-[10px] font-medium items-center text-[14px] text-white"
                  onClick={toggleProfileDropdown}
                >
                  {!isLoading ? (
                    <>
                      <span className="text-foreground hidden sm:flex truncate max-w-[140px]">
                        {displayName}
                      </span>
                      {typeof userAvatar === "string" &&
                      isCloudinaryUrl(userAvatar) ? (
                        <img
                          src={userAvatar}
                          alt="Avatar"
                          className="w-8 h-8 sm:w-6 sm:h-6 rounded-full object-cover"
                        />
                      ) : (
                        <Image
                          src={Avatar}
                          alt="Avatar"
                          width={32}
                          height={32}
                          className="rounded-full"
                        />
                      )}
                    </>
                  ) : (
                    <div className="w-16 h-8 animate-pulse bg-muted hidden sm:block" />
                  )}
                  <ChevronDown className="text-foreground w-4 h-4 sm:hidden mt-0.5" />
                </div>

                <AnimatePresence>
                  {isProfileDropdownOpen && (
                    <div className="absolute top-full -right-2 sm:right-0 mt-2 profile-dropdown-container z-50">
                      <ProfileDropdown
                        username={displayName}
                        avatar={`${userAvatar}`}
                        onLinkClick={() =>
                          setTimeout(toggleProfileDropdown, 400)
                        }
                      />
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <button
              onClick={handleConnectWallet}
              className="bg-highlight hover:bg-highlight/80 text-background px-4 py-3 rounded-md text-sm font-medium"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      <AnimatePresence>
        {isModalOpen && (
          <ConnectModal
            isModalOpen={isModalOpen}
            setIsModalOpen={setIsModalOpen}
          />
        )}
        {profileModalOpen && (
          <ProfileModal
            isOpen={profileModalOpen}
            currentStep={connectStep}
            onClose={handleCloseProfileModal}
            onNextStep={handleNextStep}
            setIsProfileModalOpen={setProfileModalOpen}
          />
        )}
      </AnimatePresence>
    </>
  );
}
