"use client";

import { AlertCircle, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { UseLiveStreamHealthReturn } from "@/hooks/useLiveStreamHealth";

/**
 * Compact live stream health indicator showing stream quality status.
 * Only renders when stream health is degraded or unavailable.
 * Displays colored dot, status label, likely cause, and last check timestamp.
 */
export default function LiveHealthIndicator(
  props: UseLiveStreamHealthReturn
): React.ReactElement | null {
  const {
    healthStatus,
    alertLevel,
    likelyCause,
    isDataAvailable,
    lastCheckedAt,
  } = props;

  // Render nothing when stream is good and healthy
  if (healthStatus === "good" && alertLevel === "none") {
    return null;
  }

  // Format last checked time
  const formatLastChecked = (): string => {
    if (!lastCheckedAt) return "never checked";

    const now = new Date();
    const diffMs = now.getTime() - lastCheckedAt.getTime();
    const diffSec = Math.round(diffMs / 1000);

    if (diffSec < 60) {
      return `checked ${diffSec}s ago`;
    }
    if (diffSec < 3600) {
      return `checked ${Math.round(diffSec / 60)}m ago`;
    }
    return lastCheckedAt.toLocaleTimeString();
  };

  // Determine icon and colors based on status
  const getStatusConfig = () => {
    if (healthStatus === "unavailable") {
      return {
        icon: Clock,
        dotClass: "bg-gray-500",
        textClass: "text-gray-700 dark:text-gray-300",
        bgClass: "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800",
        label: "Stream health data unavailable",
      };
    }

    if (alertLevel === "critical") {
      return {
        icon: AlertCircle,
        dotClass: "bg-red-600",
        textClass: "text-red-700 dark:text-red-300",
        bgClass: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800",
        label: "Stream Critical",
      };
    }

    if (alertLevel === "warning") {
      return {
        icon: AlertTriangle,
        dotClass: "bg-yellow-500",
        textClass: "text-yellow-700 dark:text-yellow-300",
        bgClass: "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800",
        label: "Stream Degraded",
      };
    }

    // Good status
    return {
      icon: CheckCircle2,
      dotClass: "bg-green-600",
      textClass: "text-green-700 dark:text-green-300",
      bgClass: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800",
      label: "Stream Healthy",
    };
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  // Format cause label
  const causeLabel = (() => {
    switch (likelyCause) {
      case "encoder":
        return "likely encoder issue";
      case "upload":
        return "likely upload/network issue";
      case "mux-side":
        return "likely Mux-side issue";
      default:
        return "unknown issue";
    }
  })();

  const statusText =
    healthStatus === "unavailable"
      ? "Stream health data unavailable"
      : `${config.label} — ${causeLabel}`;

  return (
    <div
      className={`p-3 rounded-lg border flex items-start gap-3 ${config.bgClass}`}
    >
      <div className="flex-shrink-0 mt-0.5">
        <div className={`w-2 h-2 rounded-full ${config.dotClass}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${config.textClass}`}>
          {statusText}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatLastChecked()}
        </p>
      </div>
    </div>
  );
}
