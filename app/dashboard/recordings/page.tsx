"use client";

import { useEffect, useState } from "react";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import MuxPlayer from "@/components/MuxPlayerLazy";
import { Trash2, Video } from "lucide-react";

interface Recording {
  id: string;
  mux_asset_id: string;
  playback_id: string;
  title: string | null;
  duration: number | null;
  created_at: string;
  status: string;
  stream_date: string | null;
  needs_review: boolean;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined || seconds <= 0) {
    return "—";
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    } as Intl.DateTimeFormatOptions);
  } catch {
    return iso;
  }
}

export default function RecordingsPage() {
  const { publicKey, privyWallet } = useStellarWallet();
  const walletAddress = publicKey || privyWallet?.wallet || null;
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) {
      setLoading(false);
      return;
    }
    const fetchRecordings = async () => {
      try {
        const res = await fetch(`/api/streams/recordings/${walletAddress}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch");
        }
        setRecordings(data.recordings ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load recordings");
      } finally {
        setLoading(false);
      }
    };
    fetchRecordings();
  }, [walletAddress]);

  const handleKeep = async (id: string) => {
    setBusyId(id);
    try {
      await fetch(`/api/streams/recordings/${id}`, { method: "PATCH" });
      setRecordings(prev =>
        prev.map(r => (r.id === id ? { ...r, needs_review: false } : r))
      );
    } catch {
      // Non-critical — the flag will reset next time
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    setConfirmingDeleteId(null);
    // Optimistic remove
    setRecordings(prev => prev.filter(r => r.id !== id));
    try {
      const res = await fetch(`/api/streams/recordings/${id}`, {
        method: "DELETE",
      });
      if (!res.ok && walletAddress) {
        // Restore list on failure
        const refetch = await fetch(`/api/streams/recordings/${walletAddress}`);
        if (refetch.ok) {
          const data = await refetch.json();
          setRecordings(data.recordings ?? []);
        }
      }
    } catch {
      // Ignore — optimistic removal stays
    } finally {
      setBusyId(null);
    }
  };

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

  const pendingReview = recordings.filter(r => r.needs_review);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Recordings</h1>
        <p className="text-muted-foreground text-sm">
          Replay your past streams. Enable &quot;Record Live Streams&quot; in
          Stream Settings to save future streams.
        </p>
      </header>

      {/* Post-recording prompt — shown for recordings awaiting owner review */}
      {pendingReview.length > 0 && (
        <div className="space-y-3">
          {pendingReview.map(r => (
            <div
              key={`review-${r.id}`}
              className="flex flex-col sm:flex-row sm:items-center gap-3 bg-purple-950/40 border border-purple-700/50 rounded-lg p-4"
            >
              <Video className="w-5 h-5 text-purple-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-foreground font-medium text-sm">
                  Your recording is ready
                </p>
                <p className="text-muted-foreground text-xs truncate">
                  {r.title || "Stream Recording"} ·{" "}
                  {formatDate(r.stream_date ?? r.created_at)} ·{" "}
                  {formatDuration(r.duration)}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleKeep(r.id)}
                  disabled={busyId === r.id}
                  className="px-3 py-1.5 text-sm rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  Keep it
                </button>
                <button
                  onClick={() => setConfirmingDeleteId(r.id)}
                  disabled={busyId === r.id}
                  className="px-3 py-1.5 text-sm rounded-md bg-muted text-foreground hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {recordings.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground">
          <p>No recordings yet.</p>
          <p className="text-sm mt-2">
            Turn on &quot;Record Live Streams&quot; in Stream Settings, then go
            live to create recordings.
          </p>
        </div>
      ) : (
        <ul className="space-y-6">
          {recordings.map(r => (
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
                    {formatDate(r.stream_date ?? r.created_at)} ·{" "}
                    {formatDuration(r.duration)}
                    {r.status !== "ready" && (
                      <span className="ml-2 text-amber-600">({r.status})</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm"
                    onClick={() =>
                      setPlayingId(playingId === r.id ? null : r.id)
                    }
                  >
                    {playingId === r.id ? "Hide player" : "Play"}
                  </button>
                  {confirmingDeleteId === r.id ? (
                    <>
                      <button
                        onClick={() => setConfirmingDeleteId(null)}
                        className="px-3 py-2 text-sm rounded-md bg-muted text-foreground hover:bg-muted/80"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        disabled={busyId === r.id}
                        className="px-3 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Confirm delete
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteId(r.id)}
                      className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Delete recording"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
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
