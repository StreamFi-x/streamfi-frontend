"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[App Error Boundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto text-red-500 mb-4">
            <AlertTriangle className="w-full h-full" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Something Went Wrong
          </h1>
          <p className="text-muted-foreground mb-6">
            We encountered an unexpected error. Our team has been notified.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground mb-4">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <button
            onClick={reset}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
          <Link
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors font-medium text-foreground"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
