"use client";

import { useState } from "react";
import Sidebar from "@/components/dashboard/common/sidebar";
import { motion } from "framer-motion";
import Navbar from "@/components/explore/navbar";
import { ReactNode } from "react";
import ProtectedRoute from "@/components/auth/protected-route";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <ProtectedRoute>
      <main className="flex h-screen flex-col">
        <Navbar />
        <div className="flex flel flex- h-screen overflow-hidden ">
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
    </ProtectedRoute>
  );
}
