"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems, recommendedUsers } from "@/data/explore/sidebar";
import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";
import QuickActions from "./quick-actions";
import {
  bgClasses,
  textClasses,
  borderClasses,
  buttonClasses,
} from "@/lib/theme-classes";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const isRouteActive = (href: string) => {
    if (href === "/" && pathname === "/explore") return true;
    return (
      pathname === `/explore${href}` || pathname.startsWith(`/explore${href}/`)
    );
  };

  const sidebarWidth = isCollapsed ? 70 : 260;

  const contentVariants = {
    expanded: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: {
        duration: 0.4,
        ease: [0.25, 0.1, 0.25, 1],
        staggerChildren: 0.03,
      },
    },
    collapsed: {
      opacity: 0,
      x: -20,
      scale: 0.9,
      transition: {
        duration: 0.25,
        ease: [0.25, 0.1, 0.25, 1],
      },
    },
  };

  const itemVariants = {
    expanded: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: {
        duration: 0.3,
        ease: [0.25, 0.1, 0.25, 1],
      },
    },
    collapsed: {
      opacity: 0,
      x: -15,
      scale: 0.95,
      transition: {
        duration: 0.2,
        ease: [0.25, 0.1, 0.25, 1],
      },
    },
  };

  const renderExpandedContent = () => (
    <motion.div
      variants={contentVariants}
      initial={false}
      animate="expanded"
      exit="collapsed"
      className="w-full"
    >
      <div className="flex justify-between items-center w-full mb-4 px-[1em]">
        <motion.span variants={itemVariants} className={textClasses.secondary}>
          MENU
        </motion.span>
        <motion.button
          variants={itemVariants}
          className={`p-1 ${bgClasses.hover} rounded-full button-spring no-flicker ${textClasses.primary}`}
          onClick={toggleCollapsed}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
        >
          <motion.div
            animate={{ rotate: isCollapsed ? 180 : 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="icon-rotate"
          >
            <ArrowLeft size={20} />
          </motion.div>
        </motion.button>
      </div>
      <motion.nav variants={itemVariants} className="flex flex-col gap-1">
        {navItems.map((item, index) => {
          const isActive = isRouteActive(item.href);
          return (
            <motion.div key={item.label} variants={itemVariants} custom={index}>
              <Link
                href={`/explore${item.href}`}
                className={`flex items-center gap-3 p-3 rounded-md transition-all duration-200 ${
                  isActive
                    ? `${bgClasses.active} ${textClasses.primary} shadow-lg`
                    : `${textClasses.secondary} hover:${textClasses.primary} ${bgClasses.hover}`
                }`}
              >
                <item.icon
                  size={20}
                  className={
                    isActive ? textClasses.primary : textClasses.secondary
                  }
                />
                <span>{item.label}</span>
              </Link>
            </motion.div>
          );
        })}
      </motion.nav>

      <motion.hr
        variants={itemVariants}
        className={`my-4 border-t ${borderClasses.primary}`}
      />
      <motion.div variants={itemVariants}>
        <h3
          className={`text-xs font-semibold ${textClasses.tertiary} uppercase tracking-wider mb-3 px-1`}
        >
          RECOMMENDED
        </h3>
        <div className="space-y-1">
          {recommendedUsers.map((user, index) => (
            <motion.div key={user.name} variants={itemVariants} custom={index}>
              <Link
                href="#"
                className={`flex items-center gap-3 px-2 py-2 rounded-md ${bgClasses.hover}`}
              >
                <div
                  className={`relative w-8 h-8 rounded-full ${bgClasses.tertiary} overflow-hidden`}
                >
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
                  <div className={`text-sm ${textClasses.primary} font-medium`}>
                    {user.name}
                  </div>
                  <div className={`text-xs ${textClasses.tertiary}`}>
                    {user.status}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
        <motion.button
          variants={itemVariants}
          className={`w-full mt-3 text-sm ${buttonClasses.secondary} rounded-md py-2.5 text-center`}
        >
          See more
        </motion.button>
      </motion.div>

      <motion.hr
        variants={itemVariants}
        className={`my-4 border-t ${borderClasses.primary}`}
      />
      <motion.div variants={itemVariants}>
        <h3
          className={`text-xs font-semibold ${textClasses.tertiary} uppercase tracking-wider mb-3 px-1`}
        >
          FOLLOWING
        </h3>
        <div className="space-y-1">
          {recommendedUsers.map((user, index) => (
            <motion.div
              key={`following-${user.name}`}
              variants={itemVariants}
              custom={index}
            >
              <Link
                href="#"
                className={`flex items-center gap-3 px-2 py-2 rounded-md ${bgClasses.hover}`}
              >
                <div
                  className={`relative w-8 h-8 rounded-full ${bgClasses.tertiary} overflow-hidden`}
                >
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
                  <div className={`text-sm ${textClasses.primary} font-medium`}>
                    {user.name}
                  </div>
                  <div className={`text-xs ${textClasses.tertiary}`}>
                    {user.name === "Zyn"
                      ? "100K Followers"
                      : user.name === "monki"
                        ? "3.7K followers"
                        : "520K followers"}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
        <motion.button
          variants={itemVariants}
          className={`w-full mt-3 text-sm ${buttonClasses.secondary} rounded-md py-2.5 text-center`}
        >
          See more
        </motion.button>
      </motion.div>
    </motion.div>
  );

  const renderCollapsedContent = () => (
    <motion.div className="w-full">
      <div className="flex justify-center items-center w-full mb-4">
        <motion.button
          className={`p-1 ${bgClasses.hover} rounded-full button-spring no-flicker ${textClasses.primary}`}
          onClick={toggleCollapsed}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
        >
          <motion.div
            animate={{ rotate: isCollapsed ? 0 : 180 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="icon-rotate"
          >
            <ArrowRight size={20} />
          </motion.div>
        </motion.button>
      </div>
      <motion.nav
        variants={itemVariants}
        className="flex flex-col gap-3 items-center"
      >
        {navItems.map((item, index) => {
          const isActive = isRouteActive(item.href);
          return (
            <motion.div key={item.label} variants={itemVariants} custom={index}>
              <Link
                href={`/explore${item.href}`}
                className={`flex items-center justify-center p-3 rounded-md transition-all duration-200 ${
                  isActive
                    ? `${bgClasses.active} ${textClasses.primary} shadow-lg`
                    : `${textClasses.secondary} hover:${textClasses.primary} ${bgClasses.hover}`
                }`}
                title={item.label}
              >
                <item.icon
                  size={20}
                  className={
                    isActive ? textClasses.primary : textClasses.secondary
                  }
                />
              </Link>
            </motion.div>
          );
        })}
      </motion.nav>

      <motion.hr
        variants={itemVariants}
        className={`my-4 border-t ${borderClasses.primary}`}
      />

      <motion.div
        variants={itemVariants}
        className="flex flex-col items-center gap-3"
      >
        {recommendedUsers.map((user, index) => (
          <motion.div key={user.name} variants={itemVariants} custom={index}>
            <Link
              href="#"
              className="relative transition-transform duration-200 hover:scale-110"
              title={user.name}
            >
              <div
                className={`w-9 h-9 rounded-full ${bgClasses.tertiary} overflow-hidden`}
              >
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
          </motion.div>
        ))}
      </motion.div>

      <motion.hr
        variants={itemVariants}
        className={`my-4 border-t ${borderClasses.primary}`}
      />
      <motion.div
        variants={itemVariants}
        className="flex flex-col items-center gap-3"
      >
        {recommendedUsers.map((user, index) => (
          <motion.div
            key={`following-${user.name}`}
            variants={itemVariants}
            custom={index}
          >
            <Link
              href="#"
              className="relative transition-transform duration-200 hover:scale-110"
              title={user.name}
            >
              <div
                className={`w-9 h-9 rounded-full ${bgClasses.tertiary} overflow-hidden`}
              >
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
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );

  return (
    <>
      <motion.div
        className={`hidden lg:block ${bgClasses.sidebar} flex-shrink-0 relative overflow-hidden sidebar-container sidebar-animated border-r ${borderClasses.primary}`}
        animate={{ width: sidebarWidth }}
        transition={{
          duration: 0.5,
          ease: [0.25, 0.1, 0.25, 1],
          type: "tween",
        }}
      >
        <div className="absolute inset-0 fixed-content-width layout-stable">
          <div className="p-4 flex flex-col gap-5 h-full overflow-hidden smooth-fonts">
            <motion.div
              key={isCollapsed ? "collapsed" : "expanded"}
              variants={contentVariants}
              initial={false}
              animate="expanded"
              exit="collapsed"
              className="w-full h-full gpu-accelerated"
            >
              {isCollapsed ? renderCollapsedContent() : renderExpandedContent()}
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <QuickActions />
    </>
  );
}
