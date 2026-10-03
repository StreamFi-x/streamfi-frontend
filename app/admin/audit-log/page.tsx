"use client";

import { useState } from "react";
import { Search } from "lucide-react";

type AuditEvent = {
  id: number;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  created_at: string;
};

export default function AdminAuditLogPage() {
  const [actor, setActor] = useState("");
  const [target, setTarget] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function search(nextCursor?: string | null, append = false) {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (actor) {params.set("actor", actor);}
    if (target) {params.set("target", target);}
    if (from) {params.set("from", new Date(from).toISOString());}
    if (to) {params.set("to", new Date(to).toISOString());}
    if (nextCursor) {params.set("cursor", nextCursor);}
    try {
      const response = await fetch(`/api/admin/audit-log?${params}`, { cache: "no-store" });
      if (!response.ok) {throw new Error("Unable to load admin audit events.");}
      const body = await response.json();
      setEvents(current => append ? [...current, ...body.events] : body.events);
      setCursor(body.nextCursor ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load admin audit events.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Admin audit log</h1>
      <form className="mt-6 grid gap-3 border-b border-border pb-5 md:grid-cols-5" onSubmit={event => {event.preventDefault(); void search();}}>
        <label className="text-sm">Actor ID<input value={actor} onChange={event => setActor(event.target.value)} className="mt-1 block w-full rounded border border-border bg-background px-3 py-2" /></label>
        <label className="text-sm">Target ID<input value={target} onChange={event => setTarget(event.target.value)} className="mt-1 block w-full rounded border border-border bg-background px-3 py-2" /></label>
        <label className="text-sm">From<input type="datetime-local" value={from} onChange={event => setFrom(event.target.value)} className="mt-1 block w-full rounded border border-border bg-background px-3 py-2" /></label>
        <label className="text-sm">To<input type="datetime-local" value={to} onChange={event => setTo(event.target.value)} className="mt-1 block w-full rounded border border-border bg-background px-3 py-2" /></label>
        <button className="mt-auto inline-flex items-center justify-center gap-2 rounded bg-foreground px-4 py-2 text-sm text-background" disabled={loading}><Search size={15} aria-hidden="true" /> Search</button>
      </form>
      {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto">
        <table className="mt-5 w-full text-left text-sm">
          <thead><tr className="border-b border-border text-muted-foreground"><th className="py-3 pr-3">Time</th><th className="pr-3">Actor</th><th className="pr-3">Action</th><th className="pr-3">Target</th><th>Change</th></tr></thead>
          <tbody>
            {events.map(event => <tr key={event.id} className="border-b border-border align-top"><td className="py-3 pr-3 whitespace-nowrap">{new Date(event.created_at).toLocaleString()}</td><td className="pr-3">{event.actor_id}</td><td className="pr-3">{event.action}</td><td className="pr-3">{event.target_type}: {event.target_id}</td><td className="max-w-sm break-words"><pre className="whitespace-pre-wrap text-xs">{JSON.stringify({ before: event.before_state, after: event.after_state }, null, 2)}</pre></td></tr>)}
          </tbody>
        </table>
      </div>
      {cursor && <button onClick={() => void search(cursor, true)} disabled={loading} className="mt-5 rounded border border-border px-4 py-2 text-sm">Load more</button>}
      {!events.length && !loading && <p className="py-8 text-sm text-muted-foreground">No audit events found.</p>}
    </main>
  );
}