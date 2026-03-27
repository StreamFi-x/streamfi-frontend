"use client";

import { useState } from "react";
import Sidebar from "@/components/dashboard/common/Sidebar";
import { motion } from "framer-motion";
import Navbar from "@/components/explore/Navbar";
import { ReactNode } from "react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  BarChart2,
  Video,
  Coins,
  Settings,
  Bell,
} from "lucide-react";

const mobileNavItems = [
  { name: "Home", icon: HomeIcon, path: "/dashboard/home" },
  { name: "Stream", icon: BarChart2, path: "/dashboard/stream-manager" },
  { name: "Alerts", icon: Bell, path: "/dashboard/notifications" },
  { name: "Recordings", icon: Video, path: "/dashboard/recordings" },
  { name: "Wallet", icon: Coins, path: "/dashboard/payout" },
  { name: "Settings", icon: Settings, path: "/dashboard/settings" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <ProtectedRoute>
      <div className="flex h-dvh flex-col">
        <div className="flex-shrink-0">
          <Navbar />
        </div>

        <div className="flex flex-1 overflow-hidden bg-secondary">
          <Sidebar
            isCollapsed={isSidebarCollapsed}
            onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
          <motion.main
            className="flex-1 overflow-y-auto min-w-0 pb-16 lg:pb-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.main>
        </div>

        {/* Mobile bottom nav — dashboard only, hidden on lg+ */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-sidebar border-t border-border py-2 px-2 lg:hidden">
          <div className="flex justify-around items-center">
            {mobileNavItems.map(({ name, icon: Icon, path }) => {
              const active = pathname === path || pathname.startsWith(path);
              return (
                <Link
                  key={path}
                  href={path}
                  className="flex flex-col items-center gap-0.5 px-2 py-1"
                  aria-label={name}
                >
                  <Icon
                    size={22}
                    className={
                      active ? "text-highlight" : "text-muted-foreground"
                    }
                  />
                  <span
                    className={`text-[10px] ${active ? "text-highlight" : "text-muted-foreground"}`}
                  >
                    {name}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </ProtectedRoute>
  );
}
