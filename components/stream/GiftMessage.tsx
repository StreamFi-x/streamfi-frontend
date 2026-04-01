"use client";

import { motion } from "framer-motion";
import type { ChatMessage } from "@/types/chat";

const tierStyles: Record<string, string> = {
  flower: "from-pink-500/20 to-rose-500/10 border-pink-500/30",
  candy: "from-cyan-500/20 to-sky-500/10 border-cyan-500/30",
  crown: "from-amber-500/20 to-yellow-500/10 border-amber-500/30",
  lion: "from-orange-500/25 to-yellow-500/10 border-orange-400/40",
  dragon: "from-fuchsia-500/30 to-amber-500/10 border-fuchsia-400/40",
};

export function GiftMessage({ message }: { message: ChatMessage }) {
  const giftName = message.metadata?.gift_name ?? "Gift";
  const tierKey = giftName.toLowerCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`rounded-xl border bg-gradient-to-r px-3 py-2 ${tierStyles[tierKey] ?? "from-highlight/20 to-highlight/5 border-highlight/30"}`}
    >
      <div className="flex items-start gap-2 text-sm">
        <span className="text-lg leading-none">{message.metadata?.gift_emoji ?? "🎁"}</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">
            @{message.username} sent a {message.metadata?.gift_emoji ?? "🎁"} {giftName}
          </p>
          <p className="text-xs text-muted-foreground">
            ${message.metadata?.usd_value ?? "0.00"} USDC
          </p>
        </div>
      </div>
    </motion.div>
  );
}