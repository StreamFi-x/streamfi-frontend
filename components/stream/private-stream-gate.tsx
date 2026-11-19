"use client";

import Image from "next/image";
import Link from "next/link";
import { Lock } from "lucide-react";
import { useState } from "react";

interface PrivateStreamGateProps {
  username: string;
  privacy: "unlisted" | "subscribers_only";
  reason: string | null;
  avatar: string | null;
}

const COPY: Record<string, { title: string; body: string }> = {
  unlisted: {
    title: "This stream is unlisted",
    body: "You need an invite link from the creator to watch this stream.",
  },
  subscribers_only: {
    title: "This stream is for supporters",
    body: "Only people with an invite link from the creator can watch right now. Paid subscriptions are coming soon.",
  },
};

export default function PrivateStreamGate({
  username,
  privacy,
  reason: _reason,
  avatar,
}: PrivateStreamGateProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const copy = COPY[privacy] ?? COPY.unlisted;

  async function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password || submitting) {return;}
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/streams/password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {throw new Error("Unable to verify password");}
      window.location.reload();
    } catch {
      setError("Password not accepted. Please try again.");
    } finally {setSubmitting(false);}
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-muted flex items-center justify-center">
            {avatar ? (
              <Image
                src={avatar}
                alt={username}
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            ) : (
              <Lock className="w-7 h-7 text-muted-foreground" />
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mb-2">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <h1 className="text-xl font-semibold text-foreground">
            {_reason === "password_required" ? "Password-protected stream" : copy.title}
          </h1>
        </div>

        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          {_reason === "password_required" ? "Enter the password provided by the creator to watch this stream." : copy.body}
        </p>

        {_reason === "password_required" && <form onSubmit={submitPassword} className="mb-6 space-y-3">
          <input type="password" autoComplete="current-password" aria-label="Stream password" value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded border border-border bg-background px-3 py-2" />
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={submitting || !password} className="w-full rounded bg-highlight px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{submitting ? "Checking…" : "Watch stream"}</button>
        </form>}

        <div className="flex flex-col gap-2">
          <Link
            href={`/${username}`}
            className="px-4 py-2.5 bg-highlight hover:bg-highlight/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors"
          >
            View {username}&rsquo;s profile
          </Link>
          <Link
            href="/explore"
            className="px-4 py-2.5 bg-transparent border border-border hover:bg-accent text-foreground rounded-lg text-sm font-medium transition-colors"
          >
            Browse other streams
          </Link>
        </div>
      </div>
    </div>
  );
}
