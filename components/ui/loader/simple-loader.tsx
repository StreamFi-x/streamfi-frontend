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
        className,
      )}
    >
      {/* Dark overlay with blur */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Logo container with animation */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="animate-pulse">
          <Logo className="h-40 w-40" />
        </div>
      </div>
    </div>
  );
}

// Placeholder Logo component - replace with your actual logo
function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Image src={StreamfiLogo} alt="Streamfi Logo" />
    </div>
  );
}
