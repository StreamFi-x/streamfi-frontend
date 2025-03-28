"use client";

import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { StreamfiLogo } from "@/public/icons";
import {
  navItems,
  overlayVariants,
  recommendedUsers,
  sidebarVariants,
} from "@/data/explore/sidebar";
import Image from "next/image";
import { X } from "lucide-react";
import { SidebarProps } from "@/types/explore";

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle click outside to close sidebar
  const handleOverlayClick = useCallback(() => {
    onClose();
  }, [onClose]);

  // Common sidebar content to avoid duplication
  const renderSidebarContent = () => (
    <>
      <nav className="flex flex-col gap-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={`/explore/${item.href}`} 
              className={`flex items-center gap-2.5 p-2.5 rounded-md transition-colors ${
                isActive
                  ? "bg-[#2D2F31] text-white"
                  : "text-white/30 hover:text-white hover:bg-[#2D2F31]/60"
              }`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <hr className="bg-white/30 my-4 border-t border-white/30" />

      <div className="">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
          RECOMMENDED
        </h3>
        <div className="space-y-1">
          {recommendedUsers.map((user) => (
            <Link
              key={user.name}
              href="#"
              className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[#2D2F31]/60 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden">
                <Image
                  src={user.avatar || "/placeholder.svg"}
                  alt={user.name}
                  className="w-full h-full object-cover"
                  width={24}
                  height={24}
                />
              </div>
              <div>
                <div className="text-sm font-medium">{user.name}</div>
                <div className="text-xs text-white/30">{user.status}</div>
              </div>
            </Link>
          ))}
        </div>
        <button className="mt-2 text-sm text-gray-400 hover:text-white px-3 py-1">
          See more
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black z-20 lg:hidden"
            initial="closed"
            animate="open"
            exit="closed"
            variants={overlayVariants}
            onClick={handleOverlayClick}
          />
        )}
      </AnimatePresence>

      {/* Sidebar for mobile (animated) */}
      <motion.div
        className="fixed top-0 left-0 bottom-0 w-64 bg-background z-30 lg:hidden overflow-y-auto"
        initial="closed"
        animate={isOpen ? "open" : "closed"}
        variants={sidebarVariants}
      >
        <div className="p-4 flex flex-col gap-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Image
                src={StreamfiLogo || "/placeholder.svg"}
                alt="Streamfi Logo"
              />
            </div>
            <button
              className="p-1 rounded-full hover:bg-[#2D2F31]/60"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>

          {renderSidebarContent()}
        </div>
      </motion.div>

      {/* Sidebar for desktop (static) */}
      <div className="hidden lg:block md:w-1/6 bg-background overflow-y-auto">
        <div className="p-4 flex flex-col gap-5">{renderSidebarContent()}</div>
      </div>
    </>
  );
}
