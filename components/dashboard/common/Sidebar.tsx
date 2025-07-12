"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence, Variants, Easing } from "framer-motion";
import {
  HomeIcon as House,
  LinkIcon,
  Settings,
  BarChartIcon as ChartColumnDecreasing,
  ArrowLeftToLine,
} from "lucide-react";
import { LiaCoinsSolid } from "react-icons/lia";
import { bgClasses, textClasses, borderClasses } from "@/lib/theme-classes";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  // Define the cubic-bezier easing function properly
  const customEase: Easing = [0.23, 1, 0.32, 1];

  const navItems = [
    { name: "Home", icon: <House size={24} />, path: "/dashboard/home" },
    {
      name: "Stream Manager",
      icon: <ChartColumnDecreasing size={24} />,
      path: "/dashboard/stream-manager",
    },
    {
      name: "Stream URL",
      icon: <LinkIcon size={24} />,
      path: "/dashboard/stream-url",
    },
    {
      name: "Payout",
      icon: <LiaCoinsSolid size={24} />,
      path: "/dashboard/payout",
    },
    {
      name: "Settings",
      icon: <Settings size={24} />,
      path: "/dashboard/settings",
    },
  ];

  // Enhanced animation variants matching explore sidebar
  const sidebarVariants: Variants = {
    expanded: {
      width: 240,
      transition: {
        duration: 0.6,
        ease: customEase,
        type: "tween",
      },
    },
    collapsed: {
      width: 64,
      transition: {
        duration: 0.6,
        ease: customEase,
        type: "tween",
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
        type: "spring",
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
        ease: "easeOut",
      },
    },
    hover: {
      scale: 1.02,
      transition: {
        duration: 0.2,
        ease: "easeOut",
      },
    },
    tap: {
      scale: 0.98,
      transition: {
        duration: 0.1,
        ease: "easeOut",
      },
    },
  };

  const renderExpandedContent = () => (
    <motion.div
      variants={contentVariants}
      initial="collapsed"
      animate="expanded"
      exit="collapsed"
      className="w-full"
    >
      <motion.div
        variants={itemVariants}
        className="flex justify-between items-center w-full mb-4 px-4"
      >
        <motion.span
          variants={itemVariants}
          className={`${textClasses.secondary} font-semibold tracking-wider`}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          CREATORS DASHBOARD
        </motion.span>
        <motion.button
          variants={itemVariants}
          className={`p-2 ${bgClasses.hover} rounded-full ${textClasses.primary} relative overflow-hidden`}
          onClick={onToggle}
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <motion.div
            animate={{ rotate: isCollapsed ? 180 : 0 }}
            transition={{ duration: 0.4, ease: customEase }}
          >
            <ArrowLeftToLine size={18} />
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
          const isActive = pathname === item.path;
          return (
            <motion.div
              key={item.name}
              variants={itemVariants}
              custom={index}
              whileHover="hover"
              whileTap="tap"
              initial="rest"
              animate="rest"
            >
              <motion.div variants={navItemVariants}>
                <Link
                  href={item.path}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 relative overflow-hidden ${
                    isActive
                      ? `${bgClasses.selected} ${textClasses.primary} shadow-lg border-l-4 border-purple-500`
                      : `${textClasses.secondary} hover:${textClasses.primary} ${bgClasses.hover}`
                  }`}
                >
                  <motion.div
                    animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                  >
                    <div
                      className={
                        isActive ? textClasses.primary : textClasses.secondary
                      }
                    >
                      {item.icon}
                    </div>
                  </motion.div>
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    className="font-medium text-xs sm:text-sm"
                  >
                    {item.name}
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

      {/* <motion.hr
        variants={itemVariants}
        className={`my-4 border-t ${borderClasses.primary}`}
      /> */}

      {/* <motion.div variants={itemVariants}>
        <motion.h3
          className={`text-xs font-bold ${textClasses.tertiary} uppercase tracking-wider mb-3 px-1`}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
        >
          QUICK ACTIONS
        </motion.h3>
        <div className="space-y-2">
          <motion.button
            variants={itemVariants}
            className={`w-full text-left px-3 py-2 rounded-lg ${bgClasses.hover} ${textClasses.secondary} text-sm font-medium`}
            whileHover={{ scale: 1.02, x: 5 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            Start Stream
          </motion.button>
          <motion.button
            variants={itemVariants}
            className={`w-full text-left px-3 py-2 rounded-lg ${bgClasses.hover} ${textClasses.secondary} text-sm font-medium`}
            whileHover={{ scale: 1.02, x: 5 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            View Analytics
          </motion.button>
        </div>
      </motion.div> */}
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
          onClick={onToggle}
          whileHover={{ scale: 1.1, rotate: -5 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <motion.div
            animate={{ rotate: isCollapsed ? 0 : 180 }}
            transition={{ duration: 0.4, ease: customEase }}
          >
            <ArrowLeftToLine size={18} className="rotate-180" />
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
          const isActive = pathname === item.path;
          return (
            <motion.div
              key={item.name}
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
                href={item.path}
                className={`flex items-center justify-center p-3 rounded-lg transition-all duration-300 relative ${
                  isActive
                    ? `${bgClasses.selected} ${textClasses.primary} shadow-lg ring-2 ring-purple-500/30`
                    : `${textClasses.secondary} hover:${textClasses.primary} ${bgClasses.hover}`
                }`}
                title={item.name}
              >
                <motion.div
                  animate={isActive ? { scale: [1, 1.3, 1] } : {}}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                >
                  <div
                    className={
                      isActive ? textClasses.primary : textClasses.secondary
                    }
                  >
                    {item.icon}
                  </div>
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
        <motion.button
          initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ delay: 0.6, duration: 0.4, ease: customEase }}
          whileHover={{ scale: 1.15, rotate: 5, y: -2 }}
          whileTap={{ scale: 0.95 }}
          className={`w-10 h-10 rounded-full ${bgClasses.selected} ${textClasses.primary} flex items-center justify-center shadow-lg`}
          title="Start Stream"
        >
          <House size={18} />
        </motion.button>
        <motion.button
          initial={{ opacity: 0, scale: 0.5, rotate: 10 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ delay: 0.7, duration: 0.4, ease: customEase }}
          whileHover={{ scale: 1.15, rotate: -5, y: -2 }}
          whileTap={{ scale: 0.95 }}
          className={`w-10 h-10 rounded-full ${bgClasses.hover} ${textClasses.secondary} flex items-center justify-center shadow-lg`}
          title="Analytics"
        >
          <ChartColumnDecreasing size={18} />
        </motion.button>
      </motion.div>
    </motion.div>
  );

  return (
    <motion.aside
      className={`${bgClasses.sidebar} flex-shrink-0 relative overflow-hidden border-r ${borderClasses.primary} shadow-lg flex flex-col`}
      variants={sidebarVariants}
      animate={isCollapsed ? "collapsed" : "expanded"}
      style={{ willChange: "width" }}
    >
      <div className="absolute inset-0">
        <div className="p-4 flex flex-col gap-5 h-full overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={isCollapsed ? "collapsed" : "expanded"}
              className="w-full h-full"
              style={{ willChange: "transform, opacity" }}
            >
              {isCollapsed ? renderCollapsedContent() : renderExpandedContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  );
}
