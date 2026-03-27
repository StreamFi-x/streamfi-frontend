import React from "react";
import { Lock, Coins, ShieldCheck, Mail, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AccessGateProps {
  reason: "password" | "invite_only" | "paid" | "token_gated" | "subscription";
  streamerUsername: string;
  accessConfig?: any;
}

/**
 * AccessGate component displays the appropriate UI when a viewer is blocked
 * from watching a stream due to access control settings.
 *
 * Each case (password, paid, etc.) will be fully implemented in subsequent issues.
 */
export default function AccessGate({
  reason,
  streamerUsername,
  accessConfig,
}: AccessGateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-3xl text-center space-y-6 max-w-md mx-auto my-12 shadow-2xl animate-in fade-in zoom-in duration-300">
      <div className="w-20 h-20 bg-highlight/10 flex items-center justify-center rounded-2xl shadow-inner border border-highlight/20">
        {reason === "password" && <Lock className="w-10 h-10 text-highlight" />}
        {reason === "paid" && <Coins className="w-10 h-10 text-highlight" />}
        {reason === "token_gated" && (
          <ShieldCheck className="w-10 h-10 text-highlight" />
        )}
        {reason === "invite_only" && (
          <Mail className="w-10 h-10 text-highlight" />
        )}
        {reason === "subscription" && (
          <Users className="w-10 h-10 text-highlight" />
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-3xl font-bold text-white tracking-tight">
          {reason === "password" && "Password Protected"}
          {reason === "paid" && "Premium Stream"}
          {reason === "token_gated" && "Token Gated"}
          {reason === "invite_only" && "Invite Only"}
          {reason === "subscription" && "Subscribers Only"}
        </h2>
        <p className="text-zinc-400 text-lg leading-relaxed">
          This stream by{" "}
          <span className="text-highlight font-semibold">
            @{streamerUsername}
          </span>{" "}
          requires specific access permissions.
        </p>
      </div>

      <div className="w-full pt-4">
        {reason === "password" && (
          <div className="space-y-4">
            <div className="relative group">
              <input
                type="password"
                placeholder="Enter stream password"
                className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-highlight/50 focus:border-highlight/50 transition-all font-mono"
              />
            </div>
            <Button className="w-full bg-highlight text-black hover:bg-highlight/90 font-bold h-14 rounded-xl text-lg shadow-lg shadow-highlight/20 transform hover:scale-[1.02] active:scale-[0.98] transition-all">
              Unlock Stream
            </Button>
          </div>
        )}

        {reason === "paid" && (
          <div className="space-y-4">
            <div className="bg-zinc-800/50 p-4 rounded-2xl border border-zinc-700/50">
              <span className="text-zinc-500 text-sm uppercase tracking-widest font-bold">
                Access Fee
              </span>
              <p className="text-4xl font-black text-white mt-1">
                {accessConfig?.price_usdc || "10.00"}{" "}
                <span className="text-lg text-zinc-500">USDC</span>
              </p>
            </div>
            <Button className="w-full bg-highlight text-black hover:bg-highlight/90 font-bold h-14 rounded-xl text-lg shadow-lg shadow-highlight/20 transform hover:scale-[1.02] active:scale-[0.98] transition-all">
              Purchase Access
            </Button>
          </div>
        )}

        {reason === "token_gated" && (
          <div className="space-y-4">
            <div className="bg-highlight/5 border border-highlight/10 p-4 rounded-2xl text-left">
              <p className="text-xs text-highlight/60 uppercase tracking-widest font-bold mb-1">
                Required Asset
              </p>
              <p className="text-white font-mono text-lg truncate">
                {accessConfig?.min_balance || "1.00"}{" "}
                {accessConfig?.asset_code || "TOKEN"}
              </p>
              <p className="text-xs text-zinc-500 truncate mt-1">
                Issuer: {accessConfig?.asset_issuer || "GA..."}
              </p>
            </div>
            <Button className="w-full bg-highlight text-black hover:bg-highlight/90 font-bold h-14 rounded-xl text-lg shadow-lg shadow-highlight/20 transform hover:scale-[1.02] active:scale-[0.98] transition-all">
              Verify Portfolio
            </Button>
          </div>
        )}

        {reason === "invite_only" && (
          <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700/50 border-dashed">
            <p className="text-zinc-400">
              This stream is currently restricted to invited viewers only.
            </p>
          </div>
        )}

        {reason === "subscription" && (
          <div className="space-y-4">
            <p className="text-zinc-400">
              Join the inner circle to view this stream and exclusive content.
            </p>
            <Button className="w-full bg-highlight text-black hover:bg-highlight/90 font-bold h-14 rounded-xl text-lg shadow-lg shadow-highlight/20 transform hover:scale-[1.02] active:scale-[0.98] transition-all">
              Follow & Subscribe
            </Button>
          </div>
        )}
      </div>

      <p className="text-xs text-zinc-500 pt-4 uppercase tracking-[0.2em]">
        Secured by StreamFi-X Access Control
      </p>
    </div>
  );
}
