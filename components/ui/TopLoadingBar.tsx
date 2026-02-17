"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function TopLoadingBar() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    // Start loading animation
    setLoading(true);
    setProgress(20);

    // Simulate progress
    const timer1 = setTimeout(() => setProgress(60), 200);
    const timer2 = setTimeout(() => setProgress(80), 400);
    const timer3 = setTimeout(() => {
      setProgress(100);
      setTimeout(() => setLoading(false), 200);
    }, 800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [pathname]);

  if (!loading && progress === 0) {
    return null;
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 h-1"
      style={{
        opacity: loading ? 1 : 0,
        transition: "opacity 0.2s ease-in-out",
      }}
    >
      <div
        className="h-full bg-gradient-to-r from-purple-500 via-purple-600 to-purple-500 shadow-lg shadow-purple-500/50"
        style={{
          width: `${progress}%`,
          transition: "width 0.3s ease-out",
        }}
      >
        <div className="h-full w-full animate-pulse" />
      </div>
    </div>
  );
}
