"use client";

import useSWR from "swr";
import Link from "next/link";
import { Clock } from "lucide-react";

interface Recording {
  id: string;
  playback_id: string;
  title: string | null;
  duration: number | null;
  created_at: string;
  username: string;
  avatar: string | null;
  stream_date: string | null;
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) {
    return "";
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(iso: string | null): string {
  if (!iso) {
    return "";
  }
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return "";
  }
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function PastStreams() {
  const { data, isLoading } = useSWR("/api/streams/recordings", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const recordings: Recording[] = data?.recordings ?? [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-lg overflow-hidden">
            <div className="aspect-video bg-card" />
            <div className="p-3 flex gap-2">
              <div className="w-7 h-7 rounded-full bg-card flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-card rounded w-3/4" />
                <div className="h-3 bg-card rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (recordings.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <p className="text-base">No recordings yet.</p>
        <p className="text-sm mt-2">
          Enable &quot;Record Live Streams&quot; in Stream Settings and go live
          to create recordings.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {recordings.map(r => (
        <Link
          key={r.id}
          href={`/${r.username}`}
          className="group bg-card rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 hover:scale-[1.02]"
        >
          {/* Thumbnail */}
          <div className="relative aspect-video bg-black/20 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://image.mux.com/${r.playback_id}/thumbnail.jpg?time=5`}
              alt={r.title || "Recording"}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {r.duration && (
              <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(r.duration)}
              </span>
            )}
          </div>

          {/* Meta */}
          <div className="p-3 flex items-start gap-2">
            {r.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={r.avatar}
                alt={r.username}
                className="w-7 h-7 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-tertiary flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground line-clamp-2 leading-tight">
                {r.title || "Stream Recording"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {r.username}
              </p>
              {(r.stream_date ?? r.created_at) && (
                <p className="text-xs text-muted-foreground">
                  {formatDate(r.stream_date ?? r.created_at)}
                </p>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
