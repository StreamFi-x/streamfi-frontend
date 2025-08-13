/* eslint-disable @next/next/no-img-element */
"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { StreamfiLogoLight, StreamfiLogoShort } from "@/public/icons";
import { Search, Bell, ChevronDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { SearchResult } from "@/types/explore";
import { useAccount, useDisconnect } from "@starknet-react/core";
import { useAuth } from "@/components/auth/auth-provider";
import ConnectModal from "../connectWallet";
import ProfileModal from "./ProfileModal";
import Avatar from "@/public/Images/user.png";
import ProfileDropdown from "../ui/profileDropdown";

import {
  bgClasses,
  textClasses,
  borderClasses,
  ringClasses,
  buttonClasses,
  componentClasses,
} from "@/lib/theme-classes";

interface NavbarProps {
  onConnectWallet?: () => void;
  toggleSidebar?: () => void;
  onConnect?: () => void;
}

type Category = {
  id: string;
  title: string;
  imageurl?: string;
};

export default function Navbar({}: NavbarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { address, isConnected } = useAccount();
  const { user, refreshUser } = useAuth();
  const { disconnect } = useDisconnect();
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [connectStep, setConnectStep] = useState<
    "profile" | "verify" | "success"
  >("profile");
  const [isLoading, setIsLoading] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  // Get display name from user data or fallback to address
  const getDisplayName = useCallback(() => {
    if (user?.username) {
      return user.username;
    }

    if (typeof window !== "undefined") {
      // ✅ prevents SSR error
      try {
        const userData = sessionStorage.getItem("userData");
        if (userData) {
          const parsedUser = JSON.parse(userData);
          if (parsedUser.username) {
            return parsedUser.username;
          }
        }
      } catch (error) {
        console.error("Error parsing user data from sessionStorage:", error);
      }
    }

    if (address) {
      return `${address.substring(0, 6)}...${address.slice(-4)}`;
    }

    return "Unknown User";
  }, [user?.username, address]);

  // Returns either the placeholder, username, or sliced address
  const renderDisplayName = () => {
    // Show loading pulse while fetching user info
    if (isLoading) {
      return (
        <>
          <div className="w-24 h-6 animate-pulse bg-gray-400 rounded hidden sm:block" />
          <div className="w-5 h-5 rounded-full bg-gray-400 ml-3 animate-pulse inline-flex" />
        </>
      );
    }

    // Try to get username from auth context
    if (user?.username) {
      return user.username;
    }

    // Try to get username from sessionStorage
    try {
      const storedData = sessionStorage.getItem("userData");
      if (storedData) {
        const parsedUser = JSON.parse(storedData);
        if (parsedUser.username) {
          return parsedUser.username;
        }
      }
    } catch (err) {
      console.error("Error reading userData from sessionStorage:", err);
    }

    // Fallback to sliced address
    if (address) {
      return `${address.substring(0, 6)}...${address.slice(-4)}`;
    }

    // If all else fails
    return "Unknown User";
  };

  useEffect(() => {
    const fetchUser = async () => {
      // Only fetch if we have a username and address
      if (!user?.username || !address) {
        return;
      }

      try {
        const response = await fetch(`/api/users/${user.username}`);
        if (response.status === 404) {
          // setProfileModalOpen(true);
        } else if (response.ok) {
          const result = await response.json();
          console.log("User found:", result);
        }
      } catch (error) {
        console.error("Error finding user:", error);
      }
    };
    fetchUser();
  }, [address, user?.username]);

  const getAvatar = useCallback(() => {
    if (user?.avatar) {
      return user.avatar;
    }

    if (typeof window !== "undefined") {
      try {
        const userData = sessionStorage.getItem("userData");
        if (userData) {
          const parsedUser = JSON.parse(userData);
          if (parsedUser.avatar) {
            return parsedUser.avatar;
          }
        }
      } catch (error) {
        console.error("Error parsing user data from sessionStorage:", error);
      }
    }

    return Avatar;
  }, [user?.avatar]);

  const handleCloseProfileModal = () => {
    setProfileModalOpen(false);
  };

  const handleNextStep = (step: "profile" | "verify" | "success") => {
    setConnectStep(step);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node) &&
        searchDropdownRef.current &&
        !searchDropdownRef.current.contains(event.target as Node)
      ) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Autofocus input on mount
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Fetch live search results
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setSearchResults([]);
      return;
    }

    const fetchResults = async () => {
      try {
        const res = await fetch(
          `/api/category?title=${encodeURIComponent(searchQuery)}`
        );
        const data = await res.json();

        const normalizedResults = (data.categories ?? []).map(
          (cat: Category) => ({
            id: cat.id,
            title: cat.title,
            image: cat.imageurl || "/placeholder.svg",
            type: "category", // static label
          })
        );

        setSearchResults(normalizedResults);
      } catch (error) {
        console.error("Search fetch error:", error);
        setSearchResults([]);
      }
    };

    const debounce = setTimeout(fetchResults, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleConnectWallet = () => {
    if (isConnected) {
      disconnect();
    } else {
      setIsModalOpen(true);
    }
  };

  const handleProfileDisplayModal = useCallback(async () => {
    if (!address) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/wallet/${address}`);

      if (response.status === 404) {
        setProfileModalOpen(true);
      } else if (response.ok) {
        const result = await response.json();
        console.log("User found:", result);

        // Store the entire user object in sessionStorage
        sessionStorage.setItem("userData", JSON.stringify(result.user));
        sessionStorage.setItem("username", result.user?.username);

        // Refresh user in auth context if needed
        if (!user || user.wallet !== result.user.wallet) {
          await refreshUser(address);
        }
      }
    } catch (error) {
      console.error("Error finding user:", error);
    } finally {
      setIsLoading(false);
    }
  }, [address, user, refreshUser]);

  // Toggle profile dropdown
  const toggleProfileDropdown = () => {
    setIsProfileDropdownOpen(!isProfileDropdownOpen);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        !target.closest(".profile-dropdown-container") &&
        !target.closest(".avatar-container")
      ) {
        setIsProfileDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Close modal automatically when wallet is connected
  useEffect(() => {
    if (isConnected) {
      setIsModalOpen(false);
    }
  }, [isConnected]);

  // Fetch user data when wallet connects
  useEffect(() => {
    if (isConnected && address && !user) {
      handleProfileDisplayModal();
    }
  }, [address, isConnected, user, handleProfileDisplayModal]);
  const userAvatar = getAvatar();
  const displayName = getDisplayName();
  const truncatedDisplayName =
    displayName.length > 12 ? displayName.substring(0, 12) : displayName;

  return (
    <>
      <header
        className={`h-20 flex items-center justify-between px-4 border-b-[0.5px] ${borderClasses.primary}  ${bgClasses.highlight} z-50`}
      >
        <div className="flex items-center gap-4">
          <Link href="/explore" className="flex items-center gap-2">
            <Image
              src={StreamfiLogoLight || "/placeholder.svg"}
              alt="Streamfi Logo"
              className="dark:hidden"
            />
            <Image
              src={StreamfiLogoShort || "/placeholder.svg"}
              alt="Streamfi Logo"
              className="hidden dark:block"
            />
          </Link>
        </div>

        <div className="hidden md:block flex-1 items-center max-w-xl mx-4 relative">
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setIsSearchDropdownOpen(true);
              }}
              onFocus={() => {
                if (searchResults.length > 0) setIsSearchDropdownOpen(true);
              }}
              className={`w-full ${bgClasses.input} rounded-xl py-2 pl-10 pr-4 text-sm outline-none ${ringClasses.primary}`}
            />
            <Search
              className="absolute left-3 top-[47%] transform -translate-y-1/2 text-gray-400"
              size={16}
            />
          </div>

          <AnimatePresence>
            {isSearchDropdownOpen && searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`absolute top-full left-0 right-0 mt-2 ${componentClasses.dropdown} z-20`}
              >
                <div className="p-2">
                  {searchResults.map(result => (
                    <Link
                      key={result.id}
                      className={`flex items-center gap-3 p-2 ${bgClasses.hover} rounded-md cursor-pointer relative z-30`}
                      href={`/browse/${result.type}/${result.title.toLowerCase()}`}
                    >
                      <div className="w-10 h-10 rounded bg-gray-700 overflow-hidden">
                        <Image
                          src={result.image || "/placeholder.svg"}
                          alt={result.title}
                          className="w-full h-full object-cover"
                          width={40}
                          height={40}
                          unoptimized
                        />
                      </div>
                      <div>
                        <div
                          className={`text-sm font-medium ${textClasses.primary}`}
                        >
                          {result.title}
                        </div>
                        <div
                          className={`text-xs ${textClasses.tertiary} capitalize`}
                        >
                          {result.type}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-4">
          {isConnected && address && (
            <>
              <button>
                <Bell className={`${textClasses.primary} w-4 h-4 `} />
              </button>

              {/* Avatar with dropdown */}
              <div className="relative avatar-container">
                <div
                  className={`cursor-pointer flex gap-[10px] font-medium items-center text-[14px] ${textClasses.onColor}`}
                  onClick={toggleProfileDropdown}
                >
                  {isLoading ? (
                    // Skeletons while loading
                    <>
                      <div className="w-24 h-6 animate-pulse bg-gray-400 rounded hidden sm:block" />
                      <div className="w-6 h-6 rounded-full bg-gray-400 ml-1 animate-pulse inline-flex" />
                    </>
                  ) : (
                    <>
                      {/* Display name */}
                      <span className={`${textClasses.primary} hidden sm:flex`}>
                        {renderDisplayName()}
                      </span>

                      {/* Avatar */}
                      {typeof userAvatar === "string" &&
                      userAvatar.includes("cloudinary.com") ? (
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
                  )}

                  <ChevronDown
                    className={`${textClasses.primary} w-4 h-4 sm:hidden mt-0.5`}
                  />
                </div>

                {/* Render ProfileDropdown with AnimatePresence */}
                <AnimatePresence>
                  {isProfileDropdownOpen && (
                    <div className="absolute top-full -right-2 sm:right-0 mt-2 profile-dropdown-container z-50">
                      <ProfileDropdown
                        username={truncatedDisplayName}
                        avatar={`${userAvatar}`}
                        onLinkClick={() => {
                          setTimeout(() => {
                            toggleProfileDropdown();
                          }, 400);
                        }}
                      />
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
          {!isConnected && (
            <button
              onClick={handleConnectWallet}
              className={`${buttonClasses.connect} px-4 py-3 rounded-md text-sm font-medium`}
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
              className={`absolute inset-0 ${bgClasses.overlay}`}
              onClick={() => setIsModalOpen(false)}
            />
            {/* Modal Content */}
            <motion.div className={`${componentClasses.modal} p-6 z-10`}>
              <ConnectModal
                isModalOpen={isModalOpen}
                setIsModalOpen={setIsModalOpen}
              />
            </motion.div>
          </motion.div>
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

      {/* {isLoading && <SimpleLoader />} */}
    </>
  );
}
