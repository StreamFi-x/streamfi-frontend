"use client";

import type React from "react";

import { AnimatePresence, motion, Variants, Easing } from "framer-motion";
import { Monitor, Tablet } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

interface DashboardScreenGuardProps {
  children: React.ReactNode;
}

export default function DashboardScreenGuard({
  children,
}: DashboardScreenGuardProps) {
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Define easing function properly
  const easeOut: Easing = "easeOut";

  useEffect(() => {
    setMounted(true);

    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 1024);
    };

    // Initial check
    checkScreenSize();

    // Add event listener for window resize
    window.addEventListener("resize", checkScreenSize);

    // Cleanup
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return null;
  }

  const overlayVariants: Variants = {
    hidden: {
      opacity: 0,
      scale: 0.95,
      transition: {
        duration: 0.2,
      },
    },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.3,
        ease: easeOut,
      },
    },
  };

  const contentVariants: Variants = {
    hidden: {
      opacity: 0,
      y: 20,
      transition: {
        duration: 0.2,
      },
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        delay: 0.1,
        ease: easeOut,
      },
    },
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {isSmallScreen ? (
          <motion.div
            key="overlay"
            className="fixed inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-800 z-50 flex items-center justify-center p-6"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={overlayVariants}
          >
            <motion.div
              className="max-w-md w-full text-center space-y-6"
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
            >
              <div className="flex justify-center items-center space-x-3 mb-6">
                <Image
                  src={"/Images/stream-fi-logo.svg"}
                  alt="StreamFi Logo"
                  width={120}
                  height={120}
                />
              </div>

              <div className="flex justify-center space-x-4 mb-6">
                <div className="p-3 bg-white/10 rounded-full backdrop-blur-sm">
                  <Monitor className="w-8 h-8 text-white" />
                </div>
                <div className="p-3 bg-white/10 rounded-full backdrop-blur-sm">
                  <Tablet className="w-8 h-8 text-white" />
                </div>
              </div>

              <h1 className="text-2xl font-bold text-white mb-4">
                Dashboard Unavailable
              </h1>

              <div className="space-y-4">
                <p className="text-gray-300 leading-relaxed">
                  This dashboard is best viewed on a larger screen. Please
                  switch to a device with a screen width of 1024px or more
                  (e.g., tablet in landscape mode or desktop) to use this
                  feature.
                </p>

                <div className="bg-white/5 border border-white/10 rounded-lg p-4 backdrop-blur-sm">
                  <p className="text-sm text-gray-400">
                    <span className="font-medium text-white">
                      Current screen:
                    </span>{" "}
                    {mounted ? window.innerWidth : 0}px wide
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    <span className="font-medium text-white">Required:</span>{" "}
                    1024px or wider
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={contentVariants}
            className="w-full h-full"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
