"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  House,
  LinkIcon,
  Settings,
  ChartColumnDecreasing,
  ArrowLeftToLine,
} from "lucide-react";
import { LiaCoinsSolid } from "react-icons/lia";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

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

  return (
    <motion.aside
      className="bg-[#1A1A1A] border-r border-gray-800 flex flex-col"
      initial={false}
      animate={{ width: isCollapsed ? "64px" : "240px" }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-lg font-semibold"
          >
            Creators Dashboard
          </motion.div>
        )}
        <button
          onClick={onToggle}
          className="p-2 rounded-md  transition- focus-within:bg-transparent"
        >
          <ArrowLeftToLine className={` ${isCollapsed ? "rotate-180 " : ""}`} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.name}>
              <Link href={item.path}>
                <div
                  className={`flex items-center px-4 py-3 rounded-md transition-colors ${
                    pathname === item.path
                      ? "bg-gray-800"
                      : "hover:bg-gray-800/50"
                  }`}
                >
                  <div className="text-gray-300">{item.icon}</div>

                  {!isCollapsed && (
                    <motion.span
                      className="ml-3 whitespace-nowrap"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      {item.name}
                    </motion.span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </motion.aside>
  );
}
