"use client";

import type React from "react";
import { createContext, useContext, useState, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion"; // Import AnimatePresence
import Toast, { type ToastType } from "./toast";

interface ToastContextProps {
  showToast: (message: string, type: ToastType) => void;
}

interface ToastData {
  id: number;
  message: string;
  type: ToastType;
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = (message: string, type: ToastType) => {
    const id = Date.now();
    setToasts(prevToasts => [...prevToasts, { id, message, type }]);
  };

  const removeToast = (id: number) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col items-end">
        {" "}
        {/* Changed to top-right and items-end */}
        <AnimatePresence>
          {" "}
          {/* Wrap with AnimatePresence */}
          {toasts.map(toast => (
            <Toast
              key={toast.id}
              message={toast.message}
              type={toast.type}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
