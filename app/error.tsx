"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center p-8 max-w-md w-full border border-border bg-card rounded-2xl shadow-sm">
        <div className="mx-auto w-16 h-16 mb-6 text-destructive flex items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">
          Something went wrong
        </h1>
        <p className="text-muted-foreground mb-6 text-sm">
          An unexpected error occurred while loading this page. Please try again or return home.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => reset()} className="w-full sm:w-auto gap-2">
            <RefreshCw className="w-4 h-4" />
            Try again
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = "/";
            }}
            className="w-full sm:w-auto"
          >
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
}
