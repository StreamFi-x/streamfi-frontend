"use client";

import { useState, useEffect, type FormEvent } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AccessGateProps {
  playbackId: string;
  username: string;
  onAccessGranted: () => void;
}

function getStorageKey(playbackId: string) {
  return `stream_access_${playbackId}`;
}

export default function AccessGate({
  playbackId,
  username,
  onAccessGranted,
}: AccessGateProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem(getStorageKey(playbackId));
    if (!stored) {
      setChecking(false);
      return;
    }

    fetch("/api/streams/access/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playbackId, token: stored }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.allowed) {
          onAccessGranted();
        } else {
          sessionStorage.removeItem(getStorageKey(playbackId));
          setChecking(false);
        }
      })
      .catch(() => {
        setChecking(false);
      });
  }, [playbackId, onAccessGranted]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/streams/access/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playbackId, password }),
      });

      const data = await res.json();

      if (res.ok && data.token) {
        sessionStorage.setItem(getStorageKey(playbackId), data.token);
        onAccessGranted();
      } else if (res.status === 429) {
        setError("Too many attempts. Please try again later.");
      } else {
        setError("Incorrect password");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-background">
        <div className="text-muted-foreground">Checking access...</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full min-h-[400px] bg-background">
      <div className="w-full max-w-sm mx-auto p-6">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Password Required
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {username}&apos;s stream is password protected
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter stream password"
              autoFocus
              className="w-full px-4 py-3 bg-muted border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-highlight focus:border-transparent"
            />
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          </div>

          <Button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full bg-highlight hover:bg-highlight/90 text-white"
          >
            {loading ? "Verifying..." : "Enter Stream"}
          </Button>
        </form>
      </div>
    </div>
  );
}
