/**
 * Session Replay and Breadcrumb Tracking Types
 * Issue #1750: Add session replay or breadcrumb tooling to reconstruct user actions before an error
 */

export type BreadcrumbCategory =
  | "wallet"
  | "tipping"
  | "navigation"
  | "ui"
  | "network"
  | "console"
  | "error";

export type BreadcrumbLevel = "info" | "warning" | "error" | "debug";

export interface Breadcrumb {
  id: string;
  timestamp: number;
  category: BreadcrumbCategory;
  message: string;
  level: BreadcrumbLevel;
  data?: Record<string, unknown>;
}

export interface EnvironmentSnapshot {
  userAgent: string;
  url: string;
  pathname: string;
  viewport: { width: number; height: number };
  walletExtensions: {
    hasFreighter: boolean;
    hasAlbedo: boolean;
    hasRabet: boolean;
    hasXbull: boolean;
    hasLobstr: boolean;
  };
  networkState: {
    online: boolean;
    effectiveType?: string;
  };
  walletState: {
    isConnected: boolean;
    addressMasked: string | null;
    lastWalletId: string | null;
    hasPrivy: boolean;
  };
}

export interface SessionReplayReport {
  id: string;
  timestamp: number;
  flow: "wallet" | "tipping" | "general";
  errorMessage: string;
  errorStack?: string;
  errorDetails?: Record<string, unknown>;
  breadcrumbs: Breadcrumb[];
  environment: EnvironmentSnapshot;
  userId?: string | null;
}
