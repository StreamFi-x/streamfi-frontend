"use client";

import React from "react";
import { motion } from "framer-motion";
import { 
  Radio, 
  Users, 
  TrendingUp, 
  ArrowUpRight, 
  MoreHorizontal,
  Eye,
  UserPlus,
  Zap
} from "lucide-react";
import Image from "next/image";
import { getDefaultAvatar } from "@/lib/profile-icons";

// --- Mock Data ---

const streamsData = [
  { id: "1", streamer: "alex_stream", title: "Morning Vibes 🌅", viewers: 1240, status: "live", startedAt: "2h ago" },
  { id: "2", streamer: "crypto_king", title: "BTC Analysis Live", viewers: 850, status: "live", startedAt: "45m ago" },
  { id: "3", streamer: "gamer_pro", title: "Elden Ring DLC Run", viewers: 0, status: "not live", startedAt: "Yesterday" },
  { id: "4", streamer: "tech_talks", title: "Next.js 15 Features", viewers: 0, status: "not live", startedAt: "2 days ago" },
];

const creatorsData = [
  { id: "1", username: "sarah_jen", avatar: null, followers: 15400, relationship: "following" },
  { id: "2", username: "mike_codes", avatar: null, followers: 8200, relationship: "follow" },
  { id: "3", username: "bella_art", avatar: null, followers: 12100, relationship: "following" },
  { id: "4", username: "dave_vlogs", avatar: null, followers: 5600, relationship: "follow" },
];

const assetsData = [
  { id: "1", name: "StreamFi Token", symbol: "STFI", price: "$0.45", change: "+240%", trending: "Trending" },
  { id: "2", name: "Stellar Lumens", symbol: "XLM", price: "$0.12", change: "+12.5%", trending: "Stable" },
  { id: "3", name: "Creator Coin", symbol: "CC", price: "$1.20", change: "-5.2%", trending: "Neutral" },
  { id: "4", name: "Gifty Points", symbol: "GP", price: "$0.05", change: "+85%", trending: "Trending" },
];

// --- Components ---

function TableHeader({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-accent rounded-lg text-highlight">
          {icon}
        </div>
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
      </div>
      <button className="p-1 hover:bg-surface-hover rounded-md text-muted-foreground">
        <MoreHorizontal size={20} />
      </button>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of platform activity and assets.</p>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* Streams Table */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-sidebar rounded-xl border border-border p-6 shadow-sm"
        >
          <TableHeader title="Platform Streams" icon={<Radio size={20} />} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="pb-3 font-medium">Streamer</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium text-right">Viewers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {streamsData.map((stream) => (
                  <tr key={stream.id} className="group hover:bg-surface-hover/50 transition-colors">
                    <td className="py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">@{stream.streamer}</span>
                        <span className="text-xs text-muted-foreground truncate max-w-[180px]">{stream.title}</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        stream.status === "live" 
                          ? "bg-green-500/10 text-green-500 border-green-500/20" 
                          : "bg-muted text-muted-foreground border-border"
                      }`}>
                        {stream.status === "live" && <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />}
                        {stream.status}
                      </span>
                    </td>
                    <td className="py-4 text-right font-medium text-foreground">
                      {stream.status === "live" ? stream.viewers.toLocaleString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Creators Table */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-sidebar rounded-xl border border-border p-6 shadow-sm"
        >
          <TableHeader title="Featured Creators" icon={<Users size={20} />} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="pb-3 font-medium">Creator</th>
                  <th className="pb-3 font-medium">Followers</th>
                  <th className="pb-3 font-medium text-right">Relationship</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {creatorsData.map((creator) => (
                  <tr key={creator.id} className="group hover:bg-surface-hover/50 transition-colors">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted overflow-hidden">
                          <Image 
                            src={getDefaultAvatar(creator.username)} 
                            alt={creator.username}
                            width={32}
                            height={32}
                          />
                        </div>
                        <span className="font-semibold text-foreground">@{creator.username}</span>
                      </div>
                    </td>
                    <td className="py-4 text-muted-foreground">
                      {creator.followers.toLocaleString()}
                    </td>
                    <td className="py-4 text-right">
                      <button className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                        creator.relationship === "following"
                          ? "bg-accent text-foreground"
                          : "bg-highlight text-white hover:bg-highlight/90"
                      }`}>
                        {creator.relationship === "following" ? <Users size={14} /> : <UserPlus size={14} />}
                        {creator.relationship}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Assets Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-sidebar rounded-xl border border-border p-6 shadow-sm xl:col-span-2"
        >
          <TableHeader title="Platform Assets" icon={<Zap size={20} />} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="pb-3 font-medium">Asset</th>
                  <th className="pb-3 font-medium">Price</th>
                  <th className="pb-3 font-medium">24h Change</th>
                  <th className="pb-3 font-medium">Trend</th>
                  <th className="pb-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {assetsData.map((asset) => (
                  <tr key={asset.id} className="group hover:bg-surface-hover/50 transition-colors">
                    <td className="py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{asset.name}</span>
                        <span className="text-xs text-muted-foreground">{asset.symbol}</span>
                      </div>
                    </td>
                    <td className="py-4 font-medium text-foreground">{asset.price}</td>
                    <td className="py-4">
                      <span className={`font-bold ${asset.change.startsWith("+") ? "text-green-500" : "text-red-500"}`}>
                        {asset.change}
                      </span>
                    </td>
                    <td className="py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        asset.trending === "Trending"
                          ? "bg-orange-500/10 text-orange-500 border border-orange-500/20"
                          : "bg-muted text-muted-foreground border border-border"
                      }`}>
                        {asset.trending === "Trending" && <TrendingUp size={12} className="mr-1" />}
                        {asset.trending}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <button className="text-muted-foreground hover:text-highlight transition-colors">
                        <ArrowUpRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
