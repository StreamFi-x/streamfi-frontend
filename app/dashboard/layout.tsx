"use client";

import { useState } from "react";
import Sidebar from "@/components/dashboard/common/Sidebar";
import { motion } from "framer-motion";
import Navbar from "@/components/explore/Navbar";

import { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <main className="flex h-screen flex-col">
      <Navbar />
      <div className="flex flel flex- h-screen overflow-hidden bg-[#121212] text-white">
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
        <motion.main
          className="flex-1 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.main>
      </div>
    </main>
  );
}
