"use client";

import { Activity, Timer, Users, Radio, Coins } from "lucide-react";
import { TipCounter } from "@/components/tipping";
import { cn } from "@/lib/utils";

interface ActivityFeedProps {
  sessionTime: string;
  viewerCount: number;
  username: string | null;
  isLive: boolean;
}

export default function ActivityFeed({
  sessionTime,
  viewerCount,
  username,
  isLive,
}: ActivityFeedProps) {
  return (
    <div className="h-full bg-card border border-border rounded-xl overflow-hidden flex flex-col">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            Stream Activity
          </span>
        </div>
        {isLive && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-red-400">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            LIVE
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {/* Session stats */}
        <div className="grid grid-cols-3 gap-2">
          <SessionStat
            icon={<Timer className="w-3.5 h-3.5" />}
            label="Session"
            value={sessionTime}
            mono
          />
          <SessionStat
            icon={<Users className="w-3.5 h-3.5" />}
            label="Viewers"
            value={viewerCount.toString()}
          />
          <SessionStat
            icon={<Radio className="w-3.5 h-3.5" />}
            label="Status"
            value={isLive ? "Live" : "Offline"}
            valueClass={isLive ? "text-green-400" : "text-muted-foreground"}
          />
        </div>

        {/* Compact tip summary */}
        {username && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Coins className="w-3 h-3" />
              Tip Earnings
            </p>
            <TipCounter
              username={username}
              variant="compact"
              showRefreshButton
              autoRefresh
              refreshInterval={30000}
            />
          </div>
        )}

        {/* Events log */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Recent Events
          </p>
          <div className="flex flex-col items-center justify-center py-5 text-center text-muted-foreground/40 rounded-lg border border-dashed border-border">
            {isLive ? (
              <>
                <Activity className="w-6 h-6 mb-2" />
                <p className="text-xs">Watching for new events…</p>
              </>
            ) : (
              <>
                <Radio className="w-6 h-6 mb-2" />
                <p className="text-xs">Events appear here when you go live</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionStat({
  icon,
  label,
  value,
  mono,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="bg-secondary rounded-lg p-2.5 flex flex-col items-center text-center gap-1">
      <div className="text-muted-foreground">{icon}</div>
      <p
        className={cn(
          "text-xs font-bold text-foreground leading-none",
          mono && "font-mono",
          valueClass
        )}
      >
        {value}
      </p>
      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
    </div>
  );
}
