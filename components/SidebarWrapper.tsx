"use client";
import { usePathname } from "next/navigation";
import Sidebar from "./explore/Sidebar";
import Navbar from "./explore/Navbar";
import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import ConnectModal from "@/components/explore/ProfileModal";
import QuickActions from "./explore/quick-actions";

export default function SidebarWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Hide sidebar for homepage ("/"), api, dashboard, and admin pages
  const hideSidebar =
    pathname === "/" ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin");
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [connectStep, setConnectStep] = useState<
    "profile" | "verify" | "success"
  >("profile");

  const handleCloseModal = () => {
    setConnectModalOpen(false);
  };

  const handleNextStep = (step: "profile" | "verify" | "success") => {
    setConnectStep(step);
  };

  return (
    <>
      <div className="flex flex-col h-screen">
        {!hideSidebar && <Navbar />}
        <div className="flex h-screen overflow-hidden">
          {!hideSidebar && <Sidebar />}
          <main className="flex-1 overflow-y-auto scrollbar-hide pb-10 xl:pb-0">
            {children}
          </main>
        </div>
        <QuickActions />
      </div>
      <AnimatePresence>
        {connectModalOpen && (
          <ConnectModal
            isOpen={connectModalOpen}
            currentStep={connectStep}
            onClose={handleCloseModal}
            onNextStep={handleNextStep}
            setIsProfileModalOpen={() => setConnectModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
