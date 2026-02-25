"use client";

import { useEffect, useState } from "react";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import MuxPlayer from "@mux/mux-player-react";

interface Recording {
  id: string;
  mux_asset_id: string;
  playback_id: string;
  title: string | null;
  duration: number | null;
  created_at: string;
  status: string;
  stream_date: string | null;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function RecordingsPage() {
  const { publicKey } = useStellarWallet();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey) {
      setLoading(false);
      return;
    }
    const fetchRecordings = async () => {
      try {
        const res = await fetch(`/api/streams/recordings/${publicKey}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to fetch");
        setRecordings(data.recordings ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load recordings");
      } finally {
        setLoading(false);
      }
    };
    fetchRecordings();
  }, [publicKey]);

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-4">Recordings</h1>
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-4">Recordings</h1>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Recordings</h1>
        <p className="text-muted-foreground text-sm">
          Replay your past streams. Enable &quot;Record Live Streams&quot; in Stream Settings to save future streams.
        </p>
      </header>

      {recordings.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground">
          <p>No recordings yet.</p>
          <p className="text-sm mt-2">
            Turn on &quot;Record Live Streams&quot; in Stream Settings, then go live to create recordings.
          </p>
        </div>
      ) : (
        <ul className="space-y-6">
          {recordings.map((r) => (
            <li
              key={r.id}
              className="bg-card border border-border rounded-lg overflow-hidden"
            >
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-foreground truncate">
                    {r.title || "Stream Recording"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(r.stream_date ?? r.created_at)} · {formatDuration(r.duration)}
                    {r.status !== "ready" && (
                      <span className="ml-2 text-amber-600">({r.status})</span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                  onClick={() => setPlayingId(playingId === r.id ? null : r.id)}
                >
                  {playingId === r.id ? "Hide player" : "Play"}
                </button>
              </div>
              {playingId === r.id && r.status === "ready" && r.playback_id && (
                <div className="border-t border-border bg-black/40 aspect-video">
                  <MuxPlayer
                    playbackId={r.playback_id}
                    streamType="on-demand"
                    autoPlay
                    metadata={{
                      video_title: r.title || "Recording",
                    }}
                    primaryColor="#FFFFFF"
                    secondaryColor="#000000"
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
