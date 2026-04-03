"use client";

import { motion } from "framer-motion";
import {
  Users,
  Radio,
  ShieldAlert,
  Bug,
  UserPlus,
  LayoutGrid,
} from "lucide-react";
import { useAdminAnalytics } from "@/hooks/admin/useAdminAnalytics";

interface StatCardProps {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  index: number;
}

function StatCard({ label, value, icon, index }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4 }}
      className="bg-sidebar rounded-xl p-6 border border-border flex items-start justify-between gap-4"
    >
      <div>
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        {value === undefined ? (
          <div className="h-8 w-20 animate-pulse bg-muted rounded" />
        ) : (
          <motion.p
            className="text-3xl font-bold text-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.07 + 0.2 }}
          >
            {value.toLocaleString()}
          </motion.p>
        )}
      </div>
      <div className="p-3 bg-accent rounded-lg text-highlight shrink-0">
        {icon}
      </div>
    </motion.div>
  );
}

export default function AdminAnalyticsPage() {
  const { data, isLoading } = useAdminAnalytics();

  const stats = [
    {
      label: "Total Users",
      value: isLoading ? undefined : data?.totalUsers,
      icon: <Users size={20} />,
    },
    {
      label: "Live Now",
      value: isLoading ? undefined : data?.liveNow,
      icon: <Radio size={20} />,
    },
    {
      label: "Pending Stream Reports",
      value: isLoading ? undefined : data?.pendingStreamReports,
      icon: <ShieldAlert size={20} />,
    },
    {
      label: "Pending Bug Reports",
      value: isLoading ? undefined : data?.pendingBugReports,
      icon: <Bug size={20} />,
    },
    {
      label: "New Users (7d)",
      value: isLoading ? undefined : data?.newUsers7d,
      icon: <UserPlus size={20} />,
    },
    {
      label: "Total Categories",
      value: isLoading ? undefined : data?.totalCategories,
      icon: <LayoutGrid size={20} />,
    },
  ];

  return (
    <div className="p-6 max-w-6xl">
      <motion.h1
        className="text-2xl font-bold text-foreground mb-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Platform Analytics
      </motion.h1>
      <motion.p
        className="text-sm text-muted-foreground mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        Refreshes every 30 seconds.
      </motion.p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}
