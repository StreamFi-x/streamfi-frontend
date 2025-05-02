"use client";

import { useEffect, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  navItems,
  overlayVariants,
  recommendedUsers,
  sidebarVariants,
} from "@/data/explore/sidebar";
import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { SidebarProps } from "@/types/explore";

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

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

  
  const handleOverlayClick = useCallback(() => {
    onClose();
  }, [onClose]);

  
  const toggleCollapsed = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  
  const isRouteActive = (href: string) => {
    if (href === "/" && pathname === "/explore") return true;
    return pathname === `/explore${href}` || pathname.startsWith(`/explore${href}/`);
  };

  
  const renderExpandedContent = () => (
    <>
      
      <div className="flex justify-between items-center w-full mb-4 px-[1em]">
        <span className="text-white/60 font-medium">MENU</span>
        <button 
          className="text-white p-1 hover:bg-[#2D2F31]/60 rounded-full"
          onClick={toggleCollapsed}
        >
          <ArrowLeft size={20} />
        </button>
      </div>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = isRouteActive(item.href);
          return (
            <Link
              key={item.label}
              href={`/explore${item.href}`}
              className={`flex items-center gap-3 p-3 rounded-md transition-colors ${
                isActive
                  ? "bg-[#2D2F31] text-white"
                  : "text-white/60 hover:text-white hover:bg-[#2D2F31]/60"
              }`}
            >
              <item.icon size={20} className={isActive ? "text-white" : "text-white/60"} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <hr className="bg-white/10 my-4 border-t border-white/10" />

      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">
          RECOMMENDED
        </h3>
        <div className="space-y-1">
          {recommendedUsers.map((user) => (
            <Link
              key={user.name}
              href="#"
              className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-[#2D2F31]/60 transition-colors"
            >
              <div className="relative w-8 h-8 rounded-full bg-gray-700 overflow-hidden">
                <Image
                  src={user.avatar || "/placeholder.svg"}
                  alt={user.name}
                  className="w-full h-full object-cover"
                  width={32}
                  height={32}
                />
                {user.status.toLowerCase().includes("watching") && (
                  <div className="absolute bottom-0 left-0 bg-red-500 text-white text-[8px] px-1 rounded">
                    LIVE
                  </div>
                )}
              </div>
              <div>
                <div className="text-sm text-white font-medium">
                  {user.name}
                </div>
                <div className="text-xs text-white/40">{user.status}</div>
              </div>
            </Link>
          ))}
        </div>
        <button className="w-full mt-3 text-sm text-white bg-[#2D2F31]/60 hover:bg-[#2D2F31] rounded-md py-2.5 text-center">
          See more
        </button>
      </div>

      <hr className="bg-white/10 my-4 border-t border-white/10" />

      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">
          FOLLOWING
        </h3>
        <div className="space-y-1">
          {recommendedUsers.map((user) => (
            <Link
              key={`following-${user.name}`}
              href="#"
              className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-[#2D2F31]/60 transition-colors"
            >
              <div className="relative w-8 h-8 rounded-full bg-gray-700 overflow-hidden">
                <Image
                  src={user.avatar || "/placeholder.svg"}
                  alt={user.name}
                  className="w-full h-full object-cover"
                  width={32}
                  height={32}
                />
                {user.name !== "Guraissay" && (
                  <div className="absolute bottom-0 left-0 bg-red-500 text-white text-[8px] px-1 rounded">
                    LIVE
                  </div>
                )}
              </div>
              <div>
                <div className="text-sm text-white font-medium">
                  {user.name}
                </div>
                <div className="text-xs text-white/40">
                  {user.name === "Zyn" ? "100K Followers" : 
                   user.name === "monki" ? "3.7K followers" : 
                   "520K followers"}
                </div>
              </div>
            </Link>
          ))}
        </div>
        <button className="w-full mt-3 text-sm text-white bg-[#2D2F31]/60 hover:bg-[#2D2F31] rounded-md py-2.5 text-center">
          See more
        </button>
      </div>
    </>
  );
  const renderCollapsedContent = () => (
    <>
      <div className="flex justify-center items-center w-full mb-4">
        <button 
          className="text-white p-1 hover:bg-[#2D2F31]/60 rounded-full"
          onClick={toggleCollapsed}
        >
          <ArrowRight size={20} />
        </button>
      </div>

      <nav className="flex flex-col gap-3 items-center">
        {navItems.map((item) => {
          const isActive = isRouteActive(item.href);
          return (
            <Link
              key={item.label}
              href={`/explore${item.href}`}
              className={`flex items-center justify-center p-3 rounded-md transition-colors ${
                isActive
                  ? "bg-[#2D2F31] text-white"
                  : "text-white/60 hover:text-white hover:bg-[#2D2F31]/60"
              }`}
              title={item.label}
            >
              <item.icon size={20} className={isActive ? "text-white" : "text-white/60"} />
            </Link>
          );
        })}
      </nav>

      <hr className="bg-white/10 my-4 border-t border-white/10" />

      <div className="flex flex-col items-center gap-3">
        {recommendedUsers.map((user) => (
          <Link
            key={user.name}
            href="#"
            className="relative"
            title={user.name}
          >
            <div className="w-9 h-9 rounded-full bg-gray-700 overflow-hidden">
              <Image
                src={user.avatar || "/placeholder.svg"}
                alt={user.name}
                className="w-full h-full object-cover"
                width={36}
                height={36}
              />
            </div>
            {user.status.toLowerCase().includes("watching") && (
              <div className="absolute bottom-0 left-0 bg-red-500 text-white text-[8px] px-1 rounded">
                LIVE
              </div>
            )}
          </Link>
        ))}
      </div>

      <hr className="bg-white/10 my-4 border-t border-white/10" />

      <div className="flex flex-col items-center gap-3">
        {recommendedUsers.map((user) => (
          <Link
            key={`following-${user.name}`}
            href="#"
            className="relative"
            title={user.name}
          >
            <div className="w-9 h-9 rounded-full bg-gray-700 overflow-hidden">
              <Image
                src={user.avatar || "/placeholder.svg"}
                alt={user.name}
                className="w-full h-full object-cover"
                width={36}
                height={36}
              />
            </div>
            {user.name !== "Guraissay" && (
              <div className="absolute bottom-0 left-0 bg-red-500 text-white text-[8px] px-1 rounded">
                LIVE
              </div>
            )}
          </Link>
        ))}
      </div>
    </>
  );

  
  const renderMobileSidebarContent = () => (
    <div className="p-4 flex flex-col gap-5 h-full overflow-y-auto">
      <div className="flex justify-between items-center w-full mb-4 px-[1em]">
        <span className="text-white/60 font-medium">MENU</span>
        <button 
          className="text-white p-1 hover:bg-[#2D2F31]/60 rounded-full"
          onClick={onClose}
        >
          <ArrowLeft size={20} />
        </button>
      </div>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = isRouteActive(item.href);
          return (
            <Link
              key={item.label}
              href={`/explore${item.href}`}
              className={`flex items-center gap-3 p-3 rounded-md transition-colors ${
                isActive
                  ? "bg-[#2D2F31] text-white"
                  : "text-white/60 hover:text-white hover:bg-[#2D2F31]/60"
              }`}
              onClick={onClose}
            >
              <item.icon size={20} className={isActive ? "text-white" : "text-white/60"} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <hr className="bg-white/10 my-4 border-t border-white/10" />

      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">
          RECOMMENDED
        </h3>
        <div className="space-y-1">
          {recommendedUsers.map((user) => (
            <Link
              key={user.name}
              href="#"
              className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-[#2D2F31]/60 transition-colors"
              onClick={onClose}
            >
              <div className="relative w-8 h-8 rounded-full bg-gray-700 overflow-hidden">
                <Image
                  src={user.avatar || "/placeholder.svg"}
                  alt={user.name}
                  className="w-full h-full object-cover"
                  width={32}
                  height={32}
                />
                {user.status.toLowerCase().includes("watching") && (
                  <div className="absolute bottom-0 left-0 bg-red-500 text-white text-[8px] px-1 rounded">
                    LIVE
                  </div>
                )}
              </div>
              <div>
                <div className="text-sm text-white font-medium">
                  {user.name}
                </div>
                <div className="text-xs text-white/40">{user.status}</div>
              </div>
            </Link>
          ))}
        </div>
        <button 
          className="w-full mt-3 text-sm text-white bg-[#2D2F31]/60 hover:bg-[#2D2F31] rounded-md py-2.5 text-center"
          onClick={onClose}
        >
          See more
        </button>
      </div>

      <hr className="bg-white/10 my-4 border-t border-white/10" />

      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">
          FOLLOWING
        </h3>
        <div className="space-y-1">
          {recommendedUsers.map((user) => (
            <Link
              key={`following-${user.name}`}
              href="#"
              className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-[#2D2F31]/60 transition-colors"
              onClick={onClose}
            >
              <div className="relative w-8 h-8 rounded-full bg-gray-700 overflow-hidden">
                <Image
                  src={user.avatar || "/placeholder.svg"}
                  alt={user.name}
                  className="w-full h-full object-cover"
                  width={32}
                  height={32}
                />
                {user.name !== "Guraissay" && (
                  <div className="absolute bottom-0 left-0 bg-red-500 text-white text-[8px] px-1 rounded">
                    LIVE
                  </div>
                )}
              </div>
              <div>
                <div className="text-sm text-white font-medium">
                  {user.name}
                </div>
                <div className="text-xs text-white/40">
                  {user.name === "Zyn" ? "100K Followers" : 
                   user.name === "monki" ? "3.7K followers" : 
                   "520K followers"}
                </div>
              </div>
            </Link>
          ))}
        </div>
        <button 
          className="w-full mt-3 text-sm text-white bg-[#2D2F31]/60 hover:bg-[#2D2F31] rounded-md py-2.5 text-center"
          onClick={onClose}
        >
          See more
        </button>
      </div>
    </div>
  );

  return (
    <>
      
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

      
      <motion.div
        className="fixed top-0 left-0 bottom-0 w-64 bg-black z-30 lg:hidden scrollbar-hide overflow-y-auto"
        initial="closed"
        animate={isOpen ? "open" : "closed"}
        variants={sidebarVariants}
      >
        {renderMobileSidebarContent()}
      </motion.div>

      
      <motion.div
        className="hidden lg:block bg-[#17191A] flex-shrink-0"
        initial={{ width: "260px" }}
        animate={{ width: isCollapsed ? "70px" : "260px" }}
        transition={{ 
          type: "spring", 
          stiffness: 300, 
          damping: 30 
        }}
      >
        <div className="p-4 flex flex-col gap-5 h-full overflow-y-auto scrollbar-hide">
          {isCollapsed ? renderCollapsedContent() : renderExpandedContent()}
        </div>
      </motion.div>
    </>
  );
}