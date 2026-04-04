"use client";

import type React from "react";

import { Button } from "@/components/ui/button";

export function AccessGate(props: {
  isLoading: boolean;
  allowed: boolean;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  onRetry?: () => void;
}) {
  const { isLoading, allowed, title, description, action, onRetry } = props;

  if (allowed) {
    return null;
  }

  return (
    <div className="flex items-center justify-center w-full h-full min-h-[360px] bg-card border border-border rounded-lg p-6">
      <div className="max-w-md text-center space-y-3">
        <h2 className="text-xl font-semibold text-foreground">
          {isLoading ? "Checking access…" : (title ?? "This stream is locked")}
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        <div className="flex items-center justify-center gap-2 pt-2">
          {action}
          {onRetry && (
            <Button variant="outline" onClick={onRetry} disabled={isLoading}>
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
