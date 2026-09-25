"use client";

import { useEffect, useState, useCallback } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, formatDistanceToNow } from "date-fns";
import {
  Users,
  MessageSquare,
  TrendingDown,
  Clock,
  ChevronLeft,
  Loader,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionListItem } from "@/app/api/routes-f/analytics-session-list/route";
import type { SessionDetailResponse } from "@/app/api/routes-f/analytics-session-detail/route";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface SessionAnalyticsDashboardProps {
  creatorId: string;
  className?: string;
}

export function SessionAnalyticsDashboard({
  creatorId,
  className,
}: SessionAnalyticsDashboardProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const [page, setPage] = useState(0);

  // Fetch session list
  const {
    data: sessionListData,
    isLoading: isLoadingList,
    error: listError,
  } = useSWR(
    `/api/routes-f/analytics-session-list?creator_id=${creatorId}&limit=50&offset=${
      page * 50
    }`,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Fetch selected session details
  const {
    data: sessionDetailData,
    isLoading: isLoadingDetail,
    error: detailError,
  } = useSWR(
    selectedSessionId
      ? `/api/routes-f/analytics-session-detail?session_id=${selectedSessionId}&creator_id=${creatorId}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const sessions = sessionListData?.sessions || [];
  const totalCount = sessionListData?.total_count || 0;
  const hasMore = sessionListData?.has_more || false;

  if (!selectedSessionId) {
    return (
      <div className={cn("space-y-6", className)}>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h2 className="text-2xl font-bold text-foreground">
            Session Analytics
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Select a past stream to view detailed retention and engagement
            analytics
          </p>
        </motion.div>

        {isLoadingList ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : listError ? (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-sm text-destructive">
            Failed to load sessions
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-muted/30 border border-muted/50 rounded-lg p-8 text-center">
            <p className="text-muted-foreground">No sessions found</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <AnimatePresence>
                {sessions.map((session: SessionListItem, idx: number) => (
                  <motion.button
                    key={session.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => setSelectedSessionId(session.id)}
                    className={cn(
                      "w-full text-left p-4 rounded-lg border transition-all",
                      "hover:border-highlight/50 hover:bg-highlight/5",
                      "bg-card border-border"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">
                          {session.title || "Untitled Stream"}
                        </h3>
                        <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {session.ended_at
                              ? `${session.ended_at_estimated ? "~" : ""}${Math.floor((session.duration_seconds ?? 0) / 60)}m`
                              : "Live"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {session.peak_viewers} peak viewers
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-4 h-4" />
                            {session.total_messages} messages
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {format(new Date(session.started_at), "PPpp")}
                        </p>
                      </div>
                      {!session.has_retention_data && (
                        <div className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded ml-2 whitespace-nowrap">
                          Pending analysis
                        </div>
                      )}
                    </div>
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>

            {/* Pagination */}
            {totalCount > 50 && (
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Showing {page * 50 + 1} -{" "}
                  {Math.min((page + 1) * 50, totalCount)} of {totalCount}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className="px-3 py-1 text-sm rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={!hasMore}
                    className="px-3 py-1 text-sm rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Show selected session detail
  return (
    <div className={cn("space-y-6", className)}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-3"
      >
        <button
          onClick={() => setSelectedSessionId(null)}
          className="p-2 hover:bg-muted rounded-lg transition"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {isLoadingDetail
              ? "Loading..."
              : sessionDetailData?.session.title || "Stream Session"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isLoadingDetail
              ? null
              : format(new Date(sessionDetailData.session.started_at), "PPpp")}
          </p>
        </div>
      </motion.div>

      {isLoadingDetail ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : detailError ? (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-sm text-destructive">
          Failed to load session details
        </div>
      ) : (
        <SessionDetailView data={sessionDetailData} />
      )}
    </div>
  );
}

interface SessionDetailViewProps {
  data: SessionDetailResponse;
}

function SessionDetailView({ data }: SessionDetailViewProps) {
  const { session, retention_curve, chat_engagement, summary } = data;

  // Prepare retention curve for chart (convert seconds to minutes)
  const retentionChartData = retention_curve.map((point) => ({
    minutes: Math.floor(point.bucket_seconds / 60),
    retained: point.percentage_retained,
    viewers: point.viewers_remaining,
  }));

  // Prepare chat engagement chart data
  const chatChartData = chat_engagement.map((point) => ({
    minutes: Math.floor(point.bucket_seconds / 60),
    messages: point.message_count,
    chatters: point.unique_chatters,
  }));

  return (
    <div className="space-y-8">
      {/* Key Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <MetricCard
          label="Duration"
          value={
            session.duration_seconds !== null
              ? `${session.ended_at_estimated ? "~" : ""}${Math.floor(session.duration_seconds / 60)}m ${session.duration_seconds % 60}s`
              : "N/A"
          }
          icon={Clock}
        />
        <MetricCard
          label="Peak Viewers"
          value={session.peak_viewers.toString()}
          icon={Users}
        />
        <MetricCard
          label="Avg Concurrent"
          value={session.avg_concurrent_viewers.toString()}
          icon={Users}
        />
        <MetricCard
          label="Total Messages"
          value={session.total_messages.toString()}
          icon={MessageSquare}
        />
      </motion.div>

      {/* Retention Curve */}
      {retentionChartData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-lg p-6"
        >
          <div className="mb-6">
            <h3 className="font-semibold text-foreground mb-1">
              Viewer Retention Curve
            </h3>
            <p className="text-sm text-muted-foreground">
              Percentage of viewers retained over stream duration
            </p>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="p-3 bg-muted/30 rounded">
                <p className="text-xs text-muted-foreground">Max Retention</p>
                <p className="text-lg font-semibold text-foreground">
                  {summary.max_retention_percentage}%
                </p>
              </div>
              <div className="p-3 bg-muted/30 rounded">
                <p className="text-xs text-muted-foreground">Avg Retention</p>
                <p className="text-lg font-semibold text-foreground">
                  {summary.avg_retention_percentage}%
                </p>
              </div>
              <div className="p-3 bg-muted/30 rounded">
                <p className="text-xs text-muted-foreground">Min Retention</p>
                <p className="text-lg font-semibold text-foreground">
                  {summary.min_retention_percentage}%
                </p>
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={retentionChartData}>
              <defs>
                <linearGradient id="retentionGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis
                dataKey="minutes"
                label={{ value: "Minutes", position: "insideBottomRight", offset: -5 }}
              />
              <YAxis
                label={{ value: "Retention %", angle: -90, position: "insideLeft" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1a2e",
                  border: "1px solid #404060",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "#ccc" }}
              />
              <Area
                type="monotone"
                dataKey="retained"
                stroke="#06b6d4"
                fillOpacity={1}
                fill="url(#retentionGradient)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Chat Engagement */}
      {chatChartData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-lg p-6"
        >
          <div className="mb-6">
            <h3 className="font-semibold text-foreground mb-1">
              Chat Engagement Over Time
            </h3>
            <p className="text-sm text-muted-foreground">
              Messages and active chatters by 5-minute intervals
            </p>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="p-3 bg-muted/30 rounded">
                <p className="text-xs text-muted-foreground">Peak Messages</p>
                <p className="text-lg font-semibold text-foreground">
                  {summary.peak_chat_messages_in_bucket}
                </p>
              </div>
              <div className="p-3 bg-muted/30 rounded">
                <p className="text-xs text-muted-foreground">Avg per Viewer</p>
                <p className="text-lg font-semibold text-foreground">
                  {summary.avg_messages_per_viewer.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chatChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis
                dataKey="minutes"
                label={{ value: "Minutes", position: "insideBottomRight", offset: -5 }}
              />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1a2e",
                  border: "1px solid #404060",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "#ccc" }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="messages"
                stroke="#f59e0b"
                isAnimationActive={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="chatters"
                stroke="#10b981"
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      )}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}

function MetricCard({ label, value, icon: Icon }: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-card border border-border rounded-lg p-4"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-1">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>
        <Icon className="w-5 h-5 text-muted-foreground opacity-50" />
      </div>
    </motion.div>
  );
}
