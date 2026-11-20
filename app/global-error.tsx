"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global Error Boundary]", error);
  }, [error]);

  return (
    <html>
      <body className="bg-background">
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto text-red-500 mb-4">
                <AlertTriangle className="w-full h-full" />
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Critical Error
              </h1>
              <p className="text-muted-foreground mb-6">
                The application encountered a critical error and needs to reload. 
                Please try again.
              </p>
              {error.digest && (
                <p className="text-xs text-muted-foreground mb-4">
                  Error ID: {error.digest}
                </p>
              )}
            </div>

            <button
              onClick={() => reset()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
