"use client";

import { useEffect } from "react";

export type TipAlert = {
  id: string;
  text: string;
};

export function TipAlertOverlay(props: {
  alerts: TipAlert[];
  onExpire: (id: string) => void;
  max?: number;
}) {
  const { alerts, onExpire, max = 5 } = props;

  useEffect(() => {
    const timers = alerts.slice(0, max).map(a =>
      window.setTimeout(() => onExpire(a.id), 5000)
    );
    return () => timers.forEach(t => window.clearTimeout(t));
  }, [alerts, onExpire, max]);

  const visible = alerts.slice(0, max);

  return (
    <div className="absolute bottom-4 left-4 z-30 flex flex-col gap-2 pointer-events-none">
      {visible.map(a => (
        <div
          key={a.id}
          className="bg-black/70 text-white border border-white/10 backdrop-blur-sm rounded-md px-3 py-2 text-sm"
        >
          {a.text}
        </div>
      ))}
    </div>
  );
}

