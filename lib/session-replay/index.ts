/**
 * Session Replay and Breadcrumb Tracking Engine
 * Collects lightweight user interaction breadcrumbs, environment context, and wallet extension states.
 * Reconstructs the exact chain of user actions leading up to client-side errors in wallet/tipping flows.
 */

import {
  Breadcrumb,
  BreadcrumbCategory,
  BreadcrumbLevel,
  EnvironmentSnapshot,
  SessionReplayReport,
} from "./types";

const MAX_BREADCRUMBS = 50;
const STORAGE_KEY = "streamfi_replay_reports";
const MAX_STORED_REPORTS = 20;

class SessionReplayManager {
  private breadcrumbs: Breadcrumb[] = [];
  private isInitialized = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.initAutoListeners();
    }
  }

  /**
   * Initializes global error listeners and navigation/interaction tracking.
   */
  public initAutoListeners() {
    if (this.isInitialized || typeof window === "undefined") {
      return;
    }
    this.isInitialized = true;

    // Track page load and client-side route changes (Next.js uses pushState)
    this.addBreadcrumb({
      category: "navigation",
      message: `Page loaded: ${window.location.pathname}`,
    });
    const recordNavigation = () =>
      this.addBreadcrumb({
        category: "navigation",
        message: `Navigated to ${window.location.pathname}`,
      });
    const originalPushState = history.pushState.bind(history);
    history.pushState = (...args: Parameters<History["pushState"]>) => {
      originalPushState(...args);
      recordNavigation();
    };
    window.addEventListener("popstate", recordNavigation);

    // Track unhandled promise rejections
    window.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Unhandled promise rejection";

      this.addBreadcrumb({
        category: "error",
        message: `Unhandled rejection: ${message}`,
        level: "error",
        data: {
          stack: reason instanceof Error ? reason.stack : undefined,
        },
      });
    });

    // Track window errors
    window.addEventListener("error", (event) => {
      this.addBreadcrumb({
        category: "error",
        message: `Window error: ${event.message}`,
        level: "error",
        data: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    });

    // Track UI clicks on interactive elements
    document.addEventListener(
      "click",
      (event) => {
        try {
          const target = event.target as HTMLElement | null;
          if (!target) return;

          const buttonOrLink = target.closest("button, a, input[type='button'], [role='button']");
          if (buttonOrLink) {
            const tagName = buttonOrLink.tagName.toLowerCase();
            const textContent = (buttonOrLink.textContent || "").trim().slice(0, 40);
            const ariaLabel = buttonOrLink.getAttribute("aria-label");
            const testId = buttonOrLink.getAttribute("data-testid");
            const id = buttonOrLink.id;

            this.addBreadcrumb({
              category: "ui",
              message: `Clicked ${tagName}${id ? `#${id}` : ""}${testId ? `[${testId}]` : ""}`,
              level: "info",
              data: {
                tagName,
                label: ariaLabel || textContent || id || testId || "unlabeled",
              },
            });
          }
        } catch {
          // Prevent any DOM tracking exceptions from leaking
        }
      },
      { passive: true, capture: true }
    );
  }

  /**
   * Adds a breadcrumb to the ring buffer.
   */
  public addBreadcrumb(crumb: {
    category: BreadcrumbCategory;
    message: string;
    level?: BreadcrumbLevel;
    data?: Record<string, unknown>;
  }): void {
    const id = `bc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newCrumb: Breadcrumb = {
      id,
      timestamp: Date.now(),
      category: crumb.category,
      message: crumb.message,
      level: crumb.level || "info",
      data: crumb.data,
    };

    this.breadcrumbs.push(newCrumb);
    if (this.breadcrumbs.length > MAX_BREADCRUMBS) {
      this.breadcrumbs.shift();
    }
  }

  /**
   * Captures an environmental snapshot including installed wallet extensions.
   */
  public captureEnvironment(): EnvironmentSnapshot {
    if (typeof window === "undefined") {
      return {
        userAgent: "SSR",
        url: "",
        pathname: "",
        viewport: { width: 0, height: 0 },
        walletExtensions: {
          hasFreighter: false,
          hasAlbedo: false,
          hasRabet: false,
          hasXbull: false,
          hasLobstr: false,
        },
        networkState: { online: true },
        walletState: {
          isConnected: false,
          addressMasked: null,
          lastWalletId: null,
          hasPrivy: false,
        },
      };
    }

    const win = window as any;
    const hasFreighter = !!(win.freighter || win.stellar?.freighter);
    const hasAlbedo = !!win.albedo;
    const hasRabet = !!win.rabet;
    const hasXbull = !!win.xBullSDK;
    const hasLobstr = !!win.lobstr;

    let addressMasked: string | null = null;
    let lastWalletId: string | null = null;
    let hasPrivy = false;

    try {
      const storedAddr = localStorage.getItem("stellar_address");
      if (storedAddr && storedAddr.length >= 8) {
        addressMasked = `${storedAddr.slice(0, 4)}...${storedAddr.slice(-4)}`;
      }
      lastWalletId = localStorage.getItem("stellar_last_wallet");
      hasPrivy = !!sessionStorage.getItem("privy_user");
    } catch {
      // Storage unavailable or disabled
    }

    return {
      userAgent: navigator.userAgent || "unknown",
      url: window.location.href,
      pathname: window.location.pathname,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      walletExtensions: {
        hasFreighter,
        hasAlbedo,
        hasRabet,
        hasXbull,
        hasLobstr,
      },
      networkState: {
        online: navigator.onLine ?? true,
        effectiveType: (navigator as any).connection?.effectiveType,
      },
      walletState: {
        isConnected: !!addressMasked,
        addressMasked,
        lastWalletId,
        hasPrivy,
      },
    };
  }

  /**
   * Generates and stores a complete session replay reconstruction for an error.
   */
  public recordFlowError(
    flow: "wallet" | "tipping" | "general",
    error: unknown,
    contextDetails?: Record<string, unknown>
  ): SessionReplayReport {
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "An unknown error occurred";

    const errorStack = error instanceof Error ? error.stack : undefined;

    this.addBreadcrumb({
      category: "error",
      message: `[${flow.toUpperCase()}_ERROR] ${errorMessage}`,
      level: "error",
      data: contextDetails,
    });

    const report: SessionReplayReport = {
      id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      flow,
      errorMessage,
      errorStack,
      errorDetails: contextDetails,
      breadcrumbs: [...this.breadcrumbs],
      environment: this.captureEnvironment(),
    };

    this.persistReport(report);
    this.sendReportToServer(report);

    return report;
  }

  /**
   * Returns current breadcrumbs buffer.
   */
  public getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  /**
   * Clears in-memory breadcrumbs.
   */
  public clearBreadcrumbs(): void {
    this.breadcrumbs = [];
  }

  /**
   * Saves reports locally in localStorage for client-side diagnostic review.
   */
  private persistReport(report: SessionReplayReport): void {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const reports: SessionReplayReport[] = stored ? JSON.parse(stored) : [];
      reports.unshift(report);
      if (reports.length > MAX_STORED_REPORTS) {
        reports.pop();
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
    } catch {
      // Local storage quota or restriction
    }
  }

  /**
   * Retrieves all locally stored error replay reconstructions.
   */
  public getStoredReports(): SessionReplayReport[] {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * Retrieves a single replay report by id.
   */
  public getStoredReportById(id: string): SessionReplayReport | null {
    const reports = this.getStoredReports();
    return reports.find((r) => r.id === id) || null;
  }

  /**
   * Asynchronously posts report to backend telemetry/replay ingestion endpoint if available.
   */
  private async sendReportToServer(report: SessionReplayReport): Promise<void> {
    if (typeof window === "undefined" || !navigator.onLine) return;
    try {
      await fetch("/api/session-replay/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      });
    } catch {
      // Non-blocking fire-and-forget
    }
  }
}

export const sessionReplay = new SessionReplayManager();
