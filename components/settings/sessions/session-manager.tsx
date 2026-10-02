"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { LoaderCircle, LogOut, Monitor, RotateCw } from "lucide-react";

type ActiveSession = {
  id: string;
  device_hint: string | null;
  ip_address: string | null;
  location: string;
  last_seen_at: string;
  created_at: string;
  is_current: boolean;
};

export default function SessionManager() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadSessions(next?: string | null, append = false) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/routes-f/session${next ? `?cursor=${encodeURIComponent(next)}` : ""}`, { cache: "no-store" });
      if (!response.ok) {throw new Error("Could not load active sessions.");}
      const body = await response.json();
      setSessions(current => append ? [...current, ...body.sessions] : body.sessions);
      setCursor(next ?? null);
      setNextCursor(body.nextCursor ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load active sessions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSessions();
  }, []);

  async function revokeSession(id: string) {
    if (!window.confirm("Sign out this device? It will need to sign in again.")) {return;}
    setBusyId(id);
    try {
      const response = await fetch(`/api/routes-f/session/${id}`, { method: "DELETE" });
      if (!response.ok) {throw new Error("Could not revoke this session.");}
      setSessions(current => current.filter(session => session.id !== id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not revoke this session.");
    } finally {
      setBusyId(null);
    }
  }

  async function revokeOthers() {
    if (!window.confirm("Sign out all other devices? This keeps the current device signed in.")) {return;}
    setBusyId("all");
    try {
      const response = await fetch("/api/routes-f/session/all", { method: "DELETE" });
      if (!response.ok) {throw new Error("Could not sign out other devices.");}
      await loadSessions();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign out other devices.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Account security</p>
          <h1 className="mt-2 text-2xl font-semibold">Active sessions</h1>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void loadSessions()} className="inline-flex items-center gap-2 rounded border border-border px-3 py-2 text-sm" disabled={loading}>
            <RotateCw size={15} aria-hidden="true" /> Refresh
          </button>
          <button type="button" onClick={() => void revokeOthers()} className="inline-flex items-center gap-2 rounded border border-border px-3 py-2 text-sm" disabled={busyId !== null || sessions.filter(session => !session.is_current).length === 0}>
            <LogOut size={15} aria-hidden="true" /> Sign out other devices
          </button>
        </div>
      </header>

      {error && <p role="alert" className="mt-5 text-sm text-red-600">{error}</p>}
      {loading && sessions.length === 0 && <p className="py-10 text-sm text-muted-foreground">Loading sessions…</p>}
      {!loading && sessions.length === 0 && <p className="py-10 text-sm text-muted-foreground">No active sessions found.</p>}

      <ul className="divide-y divide-border">
        {sessions.map(session => (
          <li key={session.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
            <div className="flex min-w-0 items-start gap-3">
              <Monitor size={19} className="mt-1 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-medium">{session.device_hint || "Unknown device"}{session.is_current && <span className="ml-2 text-xs font-semibold text-emerald-700">This device</span>}</p>
                <p className="mt-1 text-sm text-muted-foreground">{session.location || "Unknown location"} · {session.ip_address || "IP unavailable"}</p>
                <p className="mt-1 text-xs text-muted-foreground">Last active {formatDistanceToNow(new Date(session.last_seen_at), { addSuffix: true })}</p>
              </div>
            </div>
            {!session.is_current && <button type="button" onClick={() => void revokeSession(session.id)} disabled={busyId !== null} className="inline-flex items-center gap-2 rounded border border-border px-3 py-2 text-sm" aria-label={`Sign out ${session.device_hint || "unknown device"}`}>
              {busyId === session.id ? <LoaderCircle size={15} className="animate-spin" /> : <LogOut size={15} aria-hidden="true" />} Sign out
            </button>}
          </li>
        ))}
      </ul>

      {nextCursor && <button type="button" onClick={() => void loadSessions(nextCursor, true)} disabled={loading} className="mt-5 rounded border border-border px-4 py-2 text-sm">Load more</button>}
      {cursor && !nextCursor && <p className="mt-5 text-xs text-muted-foreground">All active sessions shown.</p>}
    </main>
  );
}