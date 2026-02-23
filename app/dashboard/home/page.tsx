"use client";

import React, { useEffect, useState } from "react";
import { TipCounter } from "@/components/tipping";
import { motion } from "framer-motion";
import { TrendingUp, Users, Heart, Award } from "lucide-react";

export default function DashboardHome() {
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const storedUsername = sessionStorage.getItem("username");
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  if (!username) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-40 w-full max-w-2xl bg-muted rounded-2xl mb-4" />
          <div className="h-8 w-48 bg-muted rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 overflow-y-auto h-full scrollbar-hide">
      <header>
        <h1 className="text-3xl font-black text-foreground mb-2">Creator Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, <span className="text-highlight font-bold">{username}</span>! Here's how your channel is performing.</p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TipCounter
            username={username}
            variant="large"
            showRefreshButton={true}
            autoRefresh={true}
            refreshInterval={60000}
          />
        </div>

        <div className="space-y-6">
          <div className="bg-card/40 border border-border rounded-xl p-6 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-500/10 text-blue-500">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Followers</p>
              <p className="text-2xl font-bold text-foreground">1,284</p>
            </div>
          </div>

          <div className="bg-card/40 border border-border rounded-xl p-6 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-pink-500/10 text-pink-500">
              <Heart className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Subscriber Score</p>
              <p className="text-2xl font-bold text-foreground">842</p>
            </div>
          </div>

          <div className="bg-card/40 border border-border rounded-xl p-6 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-yellow-500/10 text-yellow-500">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Partner Rank</p>
              <p className="text-2xl font-bold text-foreground">Gold IV</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">Recent Activity</h2>
          <button className="text-sm text-highlight font-medium hover:underline">View All</button>
        </div>

        <div className="bg-card/30 border border-border rounded-xl divide-y divide-border">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 flex items-center justify-between hover:bg-card/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted" />
                <div>
                  <p className="text-sm font-bold text-foreground">anonymous tipped you 5.00 XLM</p>
                  <p className="text-xs text-muted-foreground">2 hours ago</p>
                </div>
              </div>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
