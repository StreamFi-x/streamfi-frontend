"use client";
import { cn } from "@/lib/utils";
import { StreamfiLogo } from "@/public/icons";
import Image from "next/image";

interface SimpleLoaderProps {
  className?: string;
}

export default function SimpleLoader({ className }: SimpleLoaderProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        className
      )}
    >
      {/* Dark overlay with blur */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Logo container with animation */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="animate-pulse">
          <Logo className="h-16 w-16" />
        </div>
        <p className="mt-4 text-white/80 text-sm font-medium">Loading...</p>
      </div>
    </div>
  );
}

// Placeholder Logo component - replace with your actual logo
function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      {/* Simple placeholder logo - replace with your SVG or image */}
      <Image src={StreamfiLogo} alt="Lgo" />
      {/* <div className="h-full w-full rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 p-0.5">

        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 opacity-75 blur-sm" />
        <div className="relative h-full w-full rounded-full bg-black flex items-center justify-center">
          <span className="text-2xl font-bold text-white">SF</span>
        </div>
      </div> */}
    </div>
  );
}
