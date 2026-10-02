"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface OverlayData {
  theme: string;
  position: string;
  fontSize: number;
  opacity: number;
  primary_color: string;
  alerts_enabled: boolean;
  channel_name?: string;
}

function OverlayContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [config, setConfig] = useState<OverlayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeAlert, setActiveAlert] = useState<{
    type: "tip" | "sub" | "gift" | "raid";
    message: string;
    subtext: string;
  } | null>(null);

  useEffect(() => {
    if (!token) {
      setError("No token provided. Please specify ?token=<your_overlay_token>");
      setLoading(false);
      return;
    }

    async function fetchConfig() {
      try {
        const res = await fetch(`/api/routes-f/overlay?token=${token}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          setError(errData.error || "Invalid or expired overlay token");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setConfig(data);
        setLoading(false);
      } catch {
        setError("Failed to load overlay configuration");
        setLoading(false);
      }
    }

    fetchConfig();
    const interval = setInterval(fetchConfig, 15000); // Periodic refresh
    return () => clearInterval(interval);
  }, [token]);

  // Demo alert trigger every 10 seconds for OBS visual preview if query param ?demo=true is present
  useEffect(() => {
    if (searchParams.get("demo") === "true") {
      const demoTimer = setTimeout(() => {
        setActiveAlert({
          type: "tip",
          message: "Alice tipped 50 XLM!",
          subtext: "Great stream! Keep it up!",
        });
        setTimeout(() => setActiveAlert(null), 5000);
      }, 2000);
      return () => clearTimeout(demoTimer);
    }
  }, [searchParams]);

  if (loading) {
    return <div className="p-4 text-xs font-mono text-white/50 bg-transparent">Loading overlay...</div>;
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-red-950/80 border border-red-500/50 text-red-200 text-sm max-w-md m-4">
        <p className="font-bold">StreamFi Overlay Error</p>
        <p className="text-xs mt-1">{error}</p>
        <p className="text-xs text-red-300/70 mt-2">
          Verify your Browser Source URL in OBS Studio matches your active overlay token.
        </p>
      </div>
    );
  }

  const positionStyles: Record<string, string> = {
    "top-left": "top-6 left-6 items-start",
    "top-right": "top-6 right-6 items-end",
    "bottom-left": "bottom-6 left-6 items-start",
    "bottom-right": "bottom-6 right-6 items-end",
  };

  const currentPosClass = positionStyles[config?.position || "bottom-right"] || positionStyles["bottom-right"];

  return (
    <main
      className="fixed inset-0 pointer-events-none bg-transparent overflow-hidden"
      style={{ opacity: config?.opacity ?? 1.0 }}
    >
      <div className={`absolute flex flex-col gap-3 ${currentPosClass}`}>
        {/* Animated Alert Banner */}
        {activeAlert && (
          <div
            className="animate-bounce transition-all duration-500 rounded-xl px-6 py-4 shadow-2xl backdrop-blur-md border border-purple-500/40"
            style={{
              backgroundColor: config?.theme === "cyberpunk" ? "rgba(10, 10, 20, 0.9)" : "rgba(24, 12, 40, 0.85)",
              color: "#ffffff",
              fontSize: `${config?.fontSize || 16}px`,
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">✨</span>
              <div>
                <p className="font-extrabold text-purple-300">{activeAlert.message}</p>
                <p className="text-sm text-gray-300">{activeAlert.subtext}</p>
              </div>
            </div>
          </div>
        )}

        {/* Live Stream Goal Ticker / Badge Widget */}
        <div
          className="rounded-xl px-5 py-3 shadow-lg backdrop-blur-md border border-white/10 flex items-center gap-4"
          style={{
            backgroundColor: "rgba(15, 15, 25, 0.8)",
            fontSize: `${(config?.fontSize || 16) * 0.9}px`,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse"></span>
            <span className="font-bold text-white tracking-wide">{config?.channel_name || "StreamFi"}</span>
          </div>
          <div className="h-4 w-px bg-white/20"></div>
          <div className="flex items-center gap-2 text-xs text-purple-200">
            <span>🎯 Tip Goal:</span>
            <span className="font-bold text-white">450 / 500 XLM</span>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function OverlayPage() {
  return (
    <Suspense fallback={<div className="bg-transparent text-white/50 p-4">Loading...</div>}>
      <OverlayContent />
    </Suspense>
  );
}
