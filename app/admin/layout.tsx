"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import Navbar from "@/components/explore/Navbar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminProtectedRoute from "@/components/admin/AdminProtectedRoute";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <AdminProtectedRoute>
      <div className="flex h-dvh flex-col">
        <div className="flex-shrink-0">
          <Navbar />
        </div>

        <div className="flex flex-1 overflow-hidden bg-secondary">
          <AdminSidebar
            isCollapsed={isCollapsed}
            onToggle={() => setIsCollapsed(c => !c)}
          />
          <motion.main
            className="flex-1 overflow-y-auto min-w-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.main>
        </div>
      </div>
    </AdminProtectedRoute>
  );
}
