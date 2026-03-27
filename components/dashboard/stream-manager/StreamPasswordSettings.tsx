"use client";

import { useState, type FormEvent } from "react";
import { Lock, Eye, EyeOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StreamPasswordSettingsProps {
  wallet: string;
  isPasswordProtected: boolean;
  onUpdate: (isProtected: boolean) => void;
}

export default function StreamPasswordSettings({
  wallet,
  isPasswordProtected,
  onUpdate,
}: StreamPasswordSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!password.trim() || password.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/streams/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, password }),
      });

      if (res.ok) {
        setMessage("Password set successfully");
        setPassword("");
        onUpdate(true);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to set password");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePassword = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/streams/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, password: null }),
      });

      if (res.ok) {
        setMessage("Password protection removed");
        setPassword("");
        onUpdate(false);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to remove password");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="bg-card border border-border rounded-xl px-4 py-3">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm w-full"
        >
          <Lock className="w-4 h-4" />
          <span>Stream Password</span>
          {isPasswordProtected && (
            <span className="ml-auto text-xs bg-highlight/10 text-highlight px-2 py-0.5 rounded">
              Active
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            Stream Password
          </span>
          {isPasswordProtected && (
            <span className="text-xs bg-highlight/10 text-highlight px-2 py-0.5 rounded">
              Active
            </span>
          )}
        </div>
        <button
          onClick={() => {
            setIsOpen(false);
            setError(null);
            setMessage(null);
          }}
          className="p-1 hover:bg-muted rounded-md transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          {isPasswordProtected
            ? "Your stream is password protected. Viewers must enter the password to watch."
            : "Set a password to restrict access to your stream."}
        </p>

        <form onSubmit={handleSetPassword} className="space-y-3">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={
                isPasswordProtected ? "Enter new password" : "Set a password"
              }
              className="w-full px-3 py-2 pr-10 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-highlight"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
          {message && <p className="text-xs text-green-500">{message}</p>}

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={saving || !password.trim()}
              className="flex-1 text-xs bg-highlight hover:bg-highlight/90 text-white"
              size="sm"
            >
              {saving
                ? "Saving..."
                : isPasswordProtected
                  ? "Update Password"
                  : "Set Password"}
            </Button>
            {isPasswordProtected && (
              <Button
                type="button"
                onClick={handleRemovePassword}
                disabled={saving}
                variant="outline"
                className="text-xs border-border text-muted-foreground hover:text-foreground"
                size="sm"
              >
                Remove
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
