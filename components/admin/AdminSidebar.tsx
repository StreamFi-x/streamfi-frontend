"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence, Variants, Easing } from "framer-motion";
import {
  BarChart2,
  Users,
  ShieldAlert,
  LayoutGrid,
  ArrowLeftToLine,
} from "lucide-react";

interface AdminSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  {
    name: "Analytics",
    icon: <BarChart2 size={24} />,
    path: "/admin/analytics",
  },
  { name: "Users", icon: <Users size={24} />, path: "/admin/users" },
  {
    name: "Moderation",
    icon: <ShieldAlert size={24} />,
    path: "/admin/moderation",
  },
  {
    name: "Categories",
    icon: <LayoutGrid size={24} />,
    path: "/admin/categories",
  },
];

export default function AdminSidebar({
  isCollapsed,
  onToggle,
}: AdminSidebarProps) {
  const pathname = usePathname();

  const customEase: Easing = [0.23, 1, 0.32, 1];

  const sidebarVariants: Variants = {
    expanded: {
      width: 240,
      transition: { duration: 0.6, ease: customEase, type: "tween" },
    },
    collapsed: {
      width: 64,
      transition: { duration: 0.6, ease: customEase, type: "tween" },
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
      transition: { duration: 0.2, ease: customEase },
    },
  };

  const navItemVariants: Variants = {
    rest: {
      scale: 1,
      backgroundColor: "transparent",
      transition: { duration: 0.2, ease: "easeOut" },
    },
    hover: { scale: 1.02, transition: { duration: 0.2, ease: "easeOut" } },
    tap: { scale: 0.98, transition: { duration: 0.1, ease: "easeOut" } },
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
        className="flex justify-between items-center w-full mb-4 px-3"
      >
        <motion.span
          variants={itemVariants}
          className="text-muted-foreground text-sm font-semibold tracking-wider"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          ADMIN PANEL
        </motion.span>
        <motion.button
          variants={itemVariants}
          className="p-2 hover:bg-surface rounded-full text-foreground relative overflow-hidden"
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

      <motion.nav variants={itemVariants} className="flex flex-col gap-0.5">
        {navItems.map((item, index) => {
          const isActive =
            pathname === item.path || pathname.startsWith(item.path);
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
                      ? "bg-accent text-foreground shadow-lg border-l-4 border-highlight"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                  }`}
                >
                  <motion.div
                    animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                  >
                    <div
                      className={
                        isActive ? "text-foreground" : "text-muted-foreground"
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
          className="p-2 hover:bg-surface-hover rounded-full text-foreground relative overflow-hidden"
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

      <motion.nav className="flex flex-col gap-2 items-center">
        {navItems.map((item, index) => {
          const isActive =
            pathname === item.path || pathname.startsWith(item.path);
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
                    ? "bg-accent text-foreground shadow-lg ring-2 ring-highlight/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                }`}
                title={item.name}
              >
                <motion.div
                  animate={isActive ? { scale: [1, 1.3, 1] } : {}}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                >
                  <div
                    className={
                      isActive ? "text-foreground" : "text-muted-foreground"
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
        className="my-4 border-t border-border"
      />
    </motion.div>
  );

  const sidebarContent = (
    <div className="p-3 flex flex-col gap-4 h-full overflow-hidden">
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
  );

  return (
    <motion.aside
      className="bg-sidebar flex-shrink-0 relative overflow-hidden border-r border-border shadow-lg flex-col flex"
      variants={sidebarVariants}
      animate={isCollapsed ? "collapsed" : "expanded"}
      style={{ willChange: "width" }}
      aria-label="Admin navigation"
    >
      <div className="absolute inset-0">{sidebarContent}</div>
    </motion.aside>
  );
}
