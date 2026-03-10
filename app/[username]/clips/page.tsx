"use client";

import { use, useState, useEffect, useRef } from "react";
import { notFound, useRouter } from "next/navigation";
import { Play, Clock, Calendar } from "lucide-react";

interface PageProps {
  params: Promise<{ username: string }>;
}

interface Recording {
  id: string;
  mux_asset_id: string;
  playback_id: string;
  title: string | null;
  duration: number | null;
  created_at: string;
  stream_date: string | null;
  username: string;
  avatar: string | null;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? "s" : ""} ago`;
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? "s" : ""} ago`;
  return `${Math.floor(days / 365)} year${Math.floor(days / 365) > 1 ? "s" : ""} ago`;
}

// Mux animated GIF preview (VOD only) — auto-plays when card enters viewport
function RecordingCard({ rec, onClick }: { rec: Recording; onClick: () => void }) {
  const cardRef = useRef<HTMLButtonElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { rootMargin: "100px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Start preview at minute 20 if the recording is long enough; otherwise 10% in
  const previewStart = rec.duration
    ? rec.duration > 1200
      ? 1200
      : Math.max(5, Math.floor(rec.duration * 0.1))
    : 60;
  const previewEnd = previewStart + 10;

  const thumb = rec.playback_id
    ? `https://image.mux.com/${rec.playback_id}/thumbnail.jpg?width=640&time=${previewStart}`
    : null;
  const gif = rec.playback_id
    ? `https://image.mux.com/${rec.playback_id}/animated.gif?width=640&fps=10&start=${previewStart}&end=${previewEnd}`
    : null;

  return (
    <button
      ref={cardRef}
      onClick={onClick}
      className="group text-left rounded-lg overflow-hidden bg-card border border-border hover:border-purple-500/50 transition-colors w-full"
    >
      {/* Thumbnail / animated preview */}
      <div className="relative aspect-video bg-black overflow-hidden">
        {thumb ? (
          <>
            {/* Static thumbnail — shows until GIF loads */}
            <img
              src={thumb}
              alt={rec.title ?? "Recording"}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Animated GIF — loads + auto-plays when card enters viewport */}
            {inView && gif && (
              <img
                src={gif}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
          </>
        ) : (
          <div className="absolute inset-0 bg-muted flex items-center justify-center">
            <Play className="w-8 h-8 text-muted-foreground" />
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
          </div>
        </div>

        {/* Duration badge */}
        {rec.duration && (
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-mono pointer-events-none">
            {formatDuration(rec.duration)}
          </div>
        )}
      </div>

      {/* Card info */}
      <div className="p-3">
        <p className="text-foreground text-sm font-medium line-clamp-2 mb-2">
          {rec.title ?? `Stream — ${timeAgo(rec.stream_date ?? rec.created_at)}`}
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {rec.duration && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(rec.duration)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {timeAgo(rec.stream_date ?? rec.created_at)}
          </span>
        </div>
      </div>
    </button>
  );
}

const ClipsPage = ({ params }: PageProps) => {
  const { username } = use(params);
  const router = useRouter();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound404, setNotFound404] = useState(false);

  useEffect(() => {
    const fetchRecordings = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/streams/recordings?username=${encodeURIComponent(username)}&limit=50`
        );
        if (res.status === 404) {
          setNotFound404(true);
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setRecordings(data.recordings ?? []);
      } catch {
        setRecordings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRecordings();
  }, [username]);

  if (notFound404) return notFound();

  return (
    <div className="bg-secondary min-h-screen p-6">
      <h2 className="text-foreground text-xl font-medium mb-6">Past Streams</h2>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-lg overflow-hidden animate-pulse">
              <div className="aspect-video bg-muted" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : recordings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <Play className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No past streams yet</p>
          <p className="text-sm mt-1">Recorded streams will appear here after going live.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {recordings.map(rec => (
            <RecordingCard
              key={rec.id}
              rec={rec}
              onClick={() => router.push(`/${username}/clips/${rec.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ClipsPage;
