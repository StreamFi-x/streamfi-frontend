"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-background p-6 text-foreground">
        <div className="text-center p-8 max-w-md w-full border border-border bg-card rounded-2xl shadow-sm">
          <div className="mx-auto w-16 h-16 mb-6 text-destructive flex items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Critical Application Error</h1>
          <p className="text-muted-foreground mb-6 text-sm">
            A critical system error occurred. Please reload the application or try again.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => reset()} className="w-full sm:w-auto gap-2">
              <RefreshCw className="w-4 h-4" />
              Try again
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                window.location.reload();
              }}
              className="w-full sm:w-auto"
            >
              Reload
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
