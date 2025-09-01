"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { CheckCircleIcon, XCircleIcon, InfoIcon, X } from "lucide-react"; // Import X icon
import { motion } from "framer-motion"; // Import motion

export type ToastType = "success" | "error" | "info";

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number; // in milliseconds
}

const Toast: React.FC<ToastProps> = ({
  message,
  type,
  onClose,
  duration = 5000,
}) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = duration - elapsed;
      if (remaining <= 0) {
        clearInterval(interval);
        onClose(); // Trigger onClose when duration is over
      } else {
        setProgress((remaining / duration) * 100);
      }
    }, 50); // Update progress every 50ms

    return () => clearInterval(interval);
  }, [duration, onClose]);

  const getIcon = () => {
    const iconClasses = "h-5 w-5 text-highlight"; // Apply purple text color and size
    switch (type) {
      case "success":
        return <CheckCircleIcon className={iconClasses} />;
      case "error":
        return <XCircleIcon className={iconClasses} />;
      case "info":
        return <InfoIcon className={iconClasses} />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }} // Start off-screen to the right
      animate={{ opacity: 1, x: 0 }} // Slide in
      exit={{ opacity: 0, x: 300 }} // Slide out to the right
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="relative flex items-center gap-3 p-4 rounded-lg bg-background shadow-xl mb-3 overflow-hidden min-w-[280px] max-w-[350px]"
      role="alert"
    >
      {getIcon()}
      <span className="text-sm font-medium flex-grow text-foreground">
        {message}
      </span>
      <button
        onClick={onClose} // Directly call onClose
        className="ml-auto p-1 rounded-md text-muted-foreground hover:bg-surface-hover transition-colors"
        aria-label="Close toast"
      >
        <X className="h-4 w-4" />
      </button>
      {/* Progress Bar */}
      <div
        className="absolute bottom-0 left-0 h-1 bg-highlight"
        style={{ width: `${progress}%` }}
      />
    </motion.div>
  );
};

export default Toast;
