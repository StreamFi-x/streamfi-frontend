"use client";
import { useState } from "react";
import type React from "react";
import Sidebar from "@/components/explore/Sidebar";
import Navbar from "@/components/explore/Navbar";

export default function UsernameLayout({
  children,
}: {
  children: React.ReactNode;
  params: { username: string };
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex  flex-col h-screen">
      <Navbar toggleSidebar={toggleSidebar} />

      <div className="flex flel flex- h-screen overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
