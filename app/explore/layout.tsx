"use client";
import type React from "react";
import { useState } from "react";
import Navbar from "@/components/explore/Navbar";
import Sidebar from "@/components/explore/Sidebar";
import { AnimatePresence } from "framer-motion";
import ConnectModal from "@/components/explore/ProfileModal";
import "../globals.css";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [connectStep, setConnectStep] = useState<
    "profile" | "verify" | "success"
  >("profile");

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  const handleConnect = () => {
    setConnectModalOpen(true);
    setConnectStep("profile");
  };

  const handleCloseModal = () => {
    setConnectModalOpen(false);
  };

  const handleNextStep = (step: "profile" | "verify" | "success") => {
    setConnectStep(step);
  };

  return (
    <main>
      <div className="flex  flex-col h-screen">
        <Navbar toggleSidebar={toggleSidebar} />

        <div className="flex flel flex- h-screen overflow-hidden">
          <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

          <main className="flex-1 overflow-y-auto">{children}
      
          </main>
        </div>
      </div>

      <AnimatePresence>
        {connectModalOpen && (
          <ConnectModal
            isOpen={connectModalOpen}
            currentStep={connectStep}
            onClose={handleCloseModal}
            onNextStep={handleNextStep}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
