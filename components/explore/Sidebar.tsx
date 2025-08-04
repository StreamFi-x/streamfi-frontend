"use client";

import { useCallback, useState } from "react";
import { motion, AnimatePresence, Variants, Easing } from "framer-motion";
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

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Helper function to render avatar images (handles Cloudinary URLs)
  const renderAvatar = (avatarUrl: string, alt: string) => {
    if (avatarUrl?.includes('cloudinary.com')) {
      return (
        <img
          src={avatarUrl}
          alt={alt}
          className="w-full h-full object-cover"
        />
      );
    }
    return (
      <Image
        src={avatarUrl || "/placeholder.svg"}
        alt={alt}
        className="w-full h-full object-cover"
        width={32}
        height={32}
      />
    );
  };

  // Define easing functions properly
  const customEase: Easing = [0.23, 1, 0.32, 1];
  const easeOut: Easing = "easeOut";
  const easeInOut: Easing = "easeInOut";

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const isRouteActive = (href: string) => {
    if (href === "/" && pathname === "/explore") return true;
    if (href === "/browse" && (pathname === "/browse" || pathname.startsWith("/browse/"))) return true;
    if (href === "/explore/browse" && (pathname === "/browse" || pathname.startsWith("/browse/"))) return true;
    return (
      pathname === `/explore${href}` || pathname.startsWith(`/explore${href}/`)
    );
  };

  // Enhanced animation variants
  const sidebarVariants: Variants = {
    expanded: {
      width: 260,
      transition: {
        duration: 0.6,
        ease: customEase,
        type: "tween" as const,
      },
    },
    collapsed: {
      width: 70,
      transition: {
        duration: 0.6,
        ease: customEase,
        type: "tween" as const,
      },
    },
  };

  const contentVariants: Variants = {
    expanded: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: {
        duration: 0.5,
        ease: customEase,
        staggerChildren: 0.02,
        delayChildren: 0.1,
      },
    },
    collapsed: {
      opacity: 0,
      x: -30,
      scale: 0.95,
      transition: {
        duration: 0.3,
        ease: customEase,
        staggerChildren: 0.01,
        staggerDirection: -1,
      },
    },
  };

  const itemVariants: Variants = {
    expanded: {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.4,
        ease: customEase,
        type: "spring" as const,
        stiffness: 300,
        damping: 30,
      },
    },
    collapsed: {
      opacity: 0,
      x: -20,
      y: -5,
      scale: 0.9,
      transition: {
        duration: 0.2,
        ease: customEase,
      },
    },
  };

  const navItemVariants: Variants = {
    rest: {
      scale: 1,
      backgroundColor: "transparent",
      transition: {
        duration: 0.2,
        ease: easeOut,
      },
    },
    hover: {
      scale: 1.02,
      transition: {
        duration: 0.2,
        ease: easeOut,
      },
    },
    tap: {
      scale: 0.98,
      transition: {
        duration: 0.1,
        ease: easeOut,
      },
    },
  };

  const avatarVariants: Variants = {
    rest: {
      scale: 1,
      rotate: 0,
      transition: {
        duration: 0.2,
        ease: easeOut,
      },
    },
    hover: {
      scale: 1.1,
      rotate: 2,
      transition: {
        duration: 0.3,
        ease: easeOut,
      },
    },
  };

  const liveIndicatorVariants: Variants = {
    animate: {
      scale: [1, 1.1, 1],
      opacity: [1, 0.8, 1],
      transition: {
        duration: 2,
        repeat: Number.POSITIVE_INFINITY,
        ease: easeInOut,
      },
    },
  };

  const renderExpandedContent = () => (
    <motion.div
      variants={contentVariants}
      initial="collapsed"
      animate="expanded"
      exit="collapsed"
      className="w-full overflow-hidden "
    >
      <motion.div
        variants={itemVariants}
        className="flex justify-between items-center w-full mb-4 px-[1em] overflow-y-auto scrollbar-hide"
      >
        <motion.span
          variants={itemVariants}
          className={`${textClasses.secondary} font-semibold tracking-wider`}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          MENU
        </motion.span>
        <motion.button
          variants={itemVariants}
          className={`p-2 ${bgClasses.hover} rounded-full ${textClasses.primary} relative overflow-hidden`}
          onClick={toggleCollapsed}
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <motion.div
            animate={{ rotate: isCollapsed ? 180 : 0 }}
            transition={{ duration: 0.4, ease: customEase }}
          >
            <ArrowLeft size={18} />
          </motion.div>
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-full"
            initial={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          />
        </motion.button>
      </motion.div>

      <motion.nav variants={itemVariants} className="flex flex-col gap-1">
        {navItems.map((item, index) => {
          const isActive = isRouteActive(item.href);
          return (
            <motion.div
              key={item.label}
              variants={itemVariants}
              custom={index}
              whileHover="hover"
              whileTap="tap"
              initial="rest"
              animate="rest"
            >
              <motion.div variants={navItemVariants}>
                <Link
                  href={item.href === "/explore/browse" ? "/browse" : (item.href === "/browse" ? item.href : `/explore${item.href}`)}
                  className={`flex items-center gap-3 py-1.5 px-2.5 rounded-lg transition-all duration-300 relative overflow-hidden ${
                    isActive
                      ? `${bgClasses.selected} ${textClasses.primary} shadow-lg border-l-4 border-purple-500`
                      : `${textClasses.secondary} hover:${textClasses.primary} ${bgClasses.hover}`
                  }`}
                >
                  <motion.div
                    animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ duration: 0.5, ease: easeInOut }}
                  >
                    <item.icon
                      size={20}
                      className={
                        isActive ? textClasses.primary : textClasses.secondary
                      }
                    />
                  </motion.div>
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    className="font-semibold text-xs "
                  >
                    {item.label}
                  </motion.span>
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                    />
                  )}
                </Link>
              </motion.div>
            </motion.div>
          );
        })}
      </motion.nav>

      <motion.hr
        variants={itemVariants}
        className={`my-4 border-t ${borderClasses.primary}`}
      />

      <motion.div variants={itemVariants}>
        <motion.h3
          className={`text-xs font-bold ${textClasses.tertiary} uppercase tracking- mb-3 px-1`}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
        >
          recommended
        </motion.h3>
        <div className="space-y-1">
          {recommendedUsers.map((user, index) => (
            <motion.div
              key={user.name}
              variants={itemVariants}
              custom={index}
              whileHover="hover"
              initial="rest"
              animate="rest"
            >
              <motion.div variants={navItemVariants}>
                <Link
                  href="#"
                  className={`flex items-center gap-3 px-2 py-2 rounded-lg ${bgClasses.hover}`}
                >
                  <motion.div
                    variants={avatarVariants}
                    className={`relative w-8 h-8 rounded-full ${bgClasses.tertiary} overflow-hidden`}
                  >
                    {renderAvatar(user.avatar, user.name)}
                    {user.status.toLowerCase().includes("watching") && (
                      <motion.div
                        variants={liveIndicatorVariants}
                        animate="animate"
                        className="absolute bottom-0 left-0 bg-red-500 text-white text-[6px] px-1 rounded shadow-lg"
                      >
                        LIVE
                      </motion.div>
                    )}
                  </motion.div>
                  <div>
                    <motion.div
                      className={`text-xs ${textClasses.primary} font-semibold`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.3 }}
                    >
                      {user.name}
                    </motion.div>
                    <motion.div
                      className={`text-[10px] ${textClasses.tertiary}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 + 0.1, duration: 0.3 }}
                    >
                      {user.status}
                    </motion.div>
                  </div>
                </Link>
              </motion.div>
            </motion.div>
          ))}
        </div>
        <motion.button
          variants={itemVariants}
          className={`w-full mt-3 text-xs ${buttonClasses.reset} rounded-lg py-2.5 text-center font-medium`}
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          See more
        </motion.button>
      </motion.div>

      <motion.hr
        variants={itemVariants}
        className={`my-4 border-t ${borderClasses.primary}`}
      />

      <motion.div variants={itemVariants}>
        <motion.h3
          className={`text-xs font-bold ${textClasses.tertiary} uppercase tracking mb-3 px-1`}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.3 }}
        >
          FOLLOWING
        </motion.h3>
        <div className="space-y-1">
          {recommendedUsers.map((user, index) => (
            <motion.div
              key={`following-${user.name}`}
              variants={itemVariants}
              custom={index}
              whileHover="hover"
              initial="rest"
              animate="rest"
            >
              <motion.div variants={navItemVariants}>
                <Link
                  href="#"
                  className={`flex items-center gap-3 px-2 py-2 rounded-lg ${bgClasses.hover}`}
                >
                  <motion.div
                    variants={avatarVariants}
                    className={`relative w-8 h-8 rounded-full ${bgClasses.tertiary} overflow-hidden`}
                  >
                    {renderAvatar(user.avatar, user.name)}
                    {user.name !== "Guraissay" && (
                      <motion.div
                        variants={liveIndicatorVariants}
                        animate="animate"
                        className="absolute bottom-0 left-0 bg-red-500 text-white text-[8px] px-1 rounded shadow-lg"
                      >
                        LIVE
                      </motion.div>
                    )}
                  </motion.div>
                  <div>
                    <motion.div
                      className={`text-xs ${textClasses.primary} font-semibold`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.3 }}
                    >
                      {user.name}
                    </motion.div>
                    <motion.div
                      className={`text-[10px] ${textClasses.tertiary}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 + 0.1, duration: 0.3 }}
                    >
                      {user.name === "Zyn"
                        ? "100K Followers"
                        : user.name === "monki"
                          ? "3.7K followers"
                          : "520K followers"}
                    </motion.div>
                  </div>
                </Link>
              </motion.div>
            </motion.div>
          ))}
        </div>
        <motion.button
          variants={itemVariants}
          className={`w-full mt-3 text-xs ${buttonClasses.reset} rounded-lg py-1.5 text-center font-medium`}
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          See more
        </motion.button>
      </motion.div>
    </motion.div>
  );

  const renderCollapsedContent = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3, ease: customEase }}
      className="w-full"
    >
      <div className="flex justify-center items-center w-full mb-4">
        <motion.button
          className={`p-2 ${bgClasses.hover} rounded-full ${textClasses.primary} relative overflow-hidden`}
          onClick={toggleCollapsed}
          whileHover={{ scale: 1.1, rotate: -5 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <motion.div
            animate={{ rotate: isCollapsed ? 0 : 180 }}
            transition={{ duration: 0.4, ease: customEase }}
          >
            <ArrowRight size={18} />
          </motion.div>
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-full"
            initial={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          />
        </motion.button>
      </div>

      <motion.nav className="flex flex-col gap-3 items-center">
        {navItems.map((item, index) => {
          const isActive = isRouteActive(item.href);
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                delay: index * 0.1,
                duration: 0.4,
                ease: customEase,
              }}
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                href={item.href === "/explore/browse" ? "/browse" : (item.href === "/browse" ? item.href : `/explore${item.href}`)}
                className={`flex items-center justify-center p-3 rounded-lg transition-all duration-300 relative ${
                  isActive
                    ? `${bgClasses.selected} ${textClasses.primary} shadow-lg ring-2 ring-purple-500/30`
                    : `${textClasses.secondary} hover:${textClasses.primary} ${bgClasses.hover}`
                }`}
                title={item.label}
              >
                <motion.div
                  animate={isActive ? { scale: [1, 1.3, 1] } : {}}
                  transition={{ duration: 0.6, ease: easeInOut }}
                >
                  <item.icon
                    size={20}
                    className={
                      isActive ? textClasses.primary : textClasses.secondary
                    }
                  />
                </motion.div>
                {isActive && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-transparent rounded-lg"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
              </Link>
            </motion.div>
          );
        })}
      </motion.nav>

      <motion.hr
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ delay: 0.5, duration: 0.3 }}
        className={`my-4 border-t ${borderClasses.primary}`}
      />

      <motion.div className="flex flex-col items-center gap-3">
        {recommendedUsers.map((user, index) => (
          <motion.div
            key={user.name}
            initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{
              delay: 0.6 + index * 0.1,
              duration: 0.4,
              ease: customEase,
            }}
            whileHover={{ scale: 1.15, rotate: 5, y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link href="#" className="relative" title={user.name}>
              <div
                className={`w-9 h-9 rounded-full ${bgClasses.tertiary} overflow-hidden shadow-lg`}
              >
                {renderAvatar(user.avatar, user.name)}
              </div>
              {user.status.toLowerCase().includes("watching") && (
                <motion.div
                  variants={liveIndicatorVariants}
                  animate="animate"
                  className="absolute -bottom-1 -left-1 bg-red-500 text-white text-[8px] px-1 rounded shadow-lg"
                >
                  LIVE
                </motion.div>
              )}
            </Link>
          </motion.div>
        ))}
      </motion.div>

      <motion.hr
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ delay: 0.8, duration: 0.3 }}
        className={`my-4 border-t ${borderClasses.primary}`}
      />

      <motion.div className="flex flex-col items-center gap-3">
        {recommendedUsers.map((user, index) => (
          <motion.div
            key={`following-${user.name}`}
            initial={{ opacity: 0, scale: 0.5, rotate: 10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{
              delay: 0.9 + index * 0.1,
              duration: 0.4,
              ease: customEase,
            }}
            whileHover={{ scale: 1.15, rotate: -5, y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link href="#" className="relative" title={user.name}>
              <div
                className={`w-9 h-9 rounded-full ${bgClasses.tertiary} overflow-hidden shadow-lg`}
              >
                {renderAvatar(user.avatar, user.name)}
              </div>
              {user.name !== "Guraissay" && (
                <motion.div
                  variants={liveIndicatorVariants}
                  animate="animate"
                  className="absolute -bottom-1 -left-1 bg-red-500 text-white text-[8px] px-1 rounded shadow-lg"
                >
                  LIVE
                </motion.div>
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
        className={`hidden lg:block ${bgClasses.highlight} flex-shrink-0 relative overflow- overflow-y-auto border-r ${borderClasses.primary} shadow-lg`}
        variants={sidebarVariants}
        animate={isCollapsed ? "collapsed" : "expanded"}
        style={{ willChange: "width" }}
      >
        <div className="absolute inset-0">
          <div className="p-4 flex flex-col gap-5 h-full overflow-hidden overflow-y-auto scrollbar-hide">
            <AnimatePresence mode="wait">
              <motion.div
                key={isCollapsed ? "collapsed" : "expanded"}
                className="w-full h-full"
                style={{ willChange: "transform, opacity" }}
              >
                {isCollapsed
                  ? renderCollapsedContent()
                  : renderExpandedContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      <QuickActions />
    </>
  );
}
