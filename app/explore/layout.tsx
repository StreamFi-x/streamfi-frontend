"use client";
import type React from "react";
import { useState } from "react";
import Navbar from "@/components/explore/navbar";
import Sidebar from "@/components/explore/sidebar";
import { AnimatePresence } from "framer-motion";
import ConnectModal from "@/components/explore/profile-modal";
import "../globals.css";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [connectStep, setConnectStep] = useState<
    "profile" | "verify" | "success"
  >("profile");

  // const handleConnect = () => {
  //   setConnectModalOpen(true);
  //   setConnectStep("profile");
  // };

  const handleCloseModal = () => {
    setConnectModalOpen(false);
  };

  const handleNextStep = (step: "profile" | "verify" | "success") => {
    setConnectStep(step);
  };

  return (
    <main>
      <div className="flex  flex-col h-screen">
        <Navbar />

        <div className="flex flel flex- h-screen overflow-hidden">
          <Sidebar />

          <main className="flex-1 overflow-y-auto scrollbar-hide">{children}</main>
        </div>
      </div>

      <AnimatePresence>
        {connectModalOpen && (
          <ConnectModal
            isOpen={connectModalOpen}
            currentStep={connectStep}
            onClose={handleCloseModal}
            onNextStep={handleNextStep}
            setIsProfileModalOpen={function (): void {
              throw new Error("Function not implemented.");
            }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
