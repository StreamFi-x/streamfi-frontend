"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  FREIGHTER_ID,
} from "@creit.tech/stellar-wallets-kit";
import { AlertTriangle, X } from "lucide-react";
import { getStellarNetwork, type StellarNetwork } from "@/lib/stellar/config";
import {
  getStellarNetworkGuardState,
  type StellarNetworkGuardState,
} from "@/lib/stellar/network-guard";
import { sessionReplay } from "@/lib/session-replay";
import {
  WALLET_CONNECT_ID,
  WalletConnectModule,
  createWalletConnectModule,
  isWalletConnectNotReadyError,
} from "@/lib/stellar/walletconnect";

const isDev = process.env.NODE_ENV === "development";

const network =
  getStellarNetwork() === "mainnet"
    ? WalletNetwork.PUBLIC
    : WalletNetwork.TESTNET;

const WC_INIT_RETRY_ATTEMPTS = 6;
const WC_INIT_RETRY_DELAY_MS = 300;

export interface PrivySessionUser {
  id: string;
  privyId: string;
  username: string | null;
  email: string | null;
  avatar: string | null;
  wallet: string | null;
  displayName: string | null;
}

export interface PendingWalletSwitch {
  walletId: string;
  address: string;
  privyEmail: string | null;
  privyUsername: string | null;
}

interface StellarWalletContextType {
  kit: StellarWalletsKit;
  address: string | null;
  publicKey: string | null;
  activeWalletId: string | null;
  isConnected: boolean;
  status: "connected" | "disconnected" | "connecting";
  connect: () => Promise<void>;
  connectWallet: (walletId: string) => Promise<void>;
  connectMobileWallet: () => Promise<void>;
  disconnect: () => void;
  isLoading: boolean;
  isConnecting: boolean;
  error: string | null;
  /** True when WalletConnect QR bridge is configured and registered on the kit. */
  isWalletConnectAvailable: boolean;
  unavailableWalletId: string | null;
  /** Privy-authenticated user (Google login). Null if signed in via Stellar wallet only. */
  privyWallet: PrivySessionUser | null;
  /** Populated when connecting a wallet would clear an active Privy session. */
  pendingWalletSwitch: PendingWalletSwitch | null;
  /** Explicitly confirms clearing Privy session state and activating the new wallet. */
  confirmWalletSwitch: () => void;
  /** Cancels the pending wallet switch and preserves the active Privy session. */
  cancelWalletSwitch: () => void;
  network: StellarNetwork;
  networkGuard: StellarNetworkGuardState;
  isMainnetBlocked: boolean;
}

const StellarWalletContext = createContext<
  StellarWalletContextType | undefined
>(undefined);

export const useOptionalStellarWallet = () => useContext(StellarWalletContext);

export const useStellarWallet = () => {
  const context = useContext(StellarWalletContext);
  if (!context) {
    throw new Error(
      "useStellarWallet must be used within a StellarWalletProvider"
    );
  }
  return context;
};

function readStoredPrivySession(): {
  hasSession: boolean;
  email: string | null;
  username: string | null;
} {
  if (typeof window === "undefined") {
    return { hasSession: false, email: null, username: null };
  }
  const storedRaw = sessionStorage.getItem("privy_user");
  if (!storedRaw) {
    return { hasSession: false, email: null, username: null };
  }
  try {
    const parsed = JSON.parse(storedRaw) as Partial<PrivySessionUser>;
    return {
      hasSession: true,
      email: parsed.email ?? null,
      username: parsed.username ?? sessionStorage.getItem("username") ?? null,
    };
  } catch {
    return {
      hasSession: true,
      email: null,
      username: sessionStorage.getItem("username") ?? null,
    };
  }
}

export function StellarWalletProvider({ children }: { children: ReactNode }) {
  // SSR-safe initial guard evaluation; refined with window.location.hostname on mount.
  const [networkGuard, setNetworkGuard] = useState<StellarNetworkGuardState>(
    () => getStellarNetworkGuardState({ hostname: "" })
  );
  const activeNetwork = networkGuard.network;

  // Render the same disconnected state on the server and during hydration.
  // A returning user briefly sees it until the browser restores the session.
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailableWalletId, setUnavailableWalletId] = useState<string | null>(null);
  const [privyWallet, setPrivyWallet] = useState<PrivySessionUser | null>(null);
  const [pendingWalletSwitch, setPendingWalletSwitch] =
    useState<PendingWalletSwitch | null>(null);
  const hasAttemptedAutoConnect = useRef(false);
  const walletConnectModuleRef = useRef<WalletConnectModule | null>(null);
  const activeWalletIdRef = useRef<string | null>(activeWalletId);
  const privyWalletRef = useRef<PrivySessionUser | null>(privyWallet);

  useEffect(() => {
    activeWalletIdRef.current = activeWalletId;
  }, [activeWalletId]);

  useEffect(() => {
    privyWalletRef.current = privyWallet;
  }, [privyWallet]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setNetworkGuard(
        getStellarNetworkGuardState({ hostname: window.location.hostname })
      );
    }
  }, []);

  useEffect(() => {
    if (networkGuard.isUnsafeMainnetConfig) {
      // eslint-disable-next-line no-console
      console.error(
        `[MainnetSafetyGuard] ${networkGuard.reason ?? "Stellar mainnet configured in a non-production deployment."}`
      );
    }
  }, [networkGuard.isUnsafeMainnetConfig, networkGuard.reason]);

  // Listen for successful Privy session creation (dispatched by auth-provider)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ user: PrivySessionUser }>).detail;
      if (detail?.user) {
        setPrivyWallet(detail.user);
      }
    };
    window.addEventListener("privy-wallet-set", handler);

    // Restore from sessionStorage for page refreshes
    const stored = sessionStorage.getItem("privy_user");
    if (stored) {
      try {
        setPrivyWallet(JSON.parse(stored));
      } catch {
        /* ignore */
      }
    }

    return () => window.removeEventListener("privy-wallet-set", handler);
  }, []);

  const disconnect = useCallback(() => {
    const wcModule = walletConnectModuleRef.current;
    if (wcModule && activeWalletIdRef.current === WALLET_CONNECT_ID) {
      void wcModule.disconnect().catch(() => {
        // Ignore errors if the remote session was already closed
      });
    }
    setPublicKey(null);
    setActiveWalletId(null);
    setPendingWalletSwitch(null);
    localStorage.removeItem("stellar_address");
    localStorage.removeItem("stellar_last_wallet");
    localStorage.removeItem("stellar_auto_connect");
  }, []);

  const [{ kit, isWalletConnectAvailable }] = useState(() => {
    if (typeof window === "undefined") {
      return {
        kit: null as unknown as StellarWalletsKit,
        isWalletConnectAvailable: false,
      };
    }
    const wcModule = createWalletConnectModule({
      network,
      onSessionDeleted: () => {
        if (activeWalletIdRef.current === WALLET_CONNECT_ID) {
          setPublicKey(null);
          setActiveWalletId(null);
          localStorage.removeItem("stellar_address");
          localStorage.removeItem("stellar_last_wallet");
          localStorage.removeItem("stellar_auto_connect");
        }
      },
    });
    walletConnectModuleRef.current = wcModule;
    const modules = wcModule
      ? [...allowAllModules(), wcModule]
      : allowAllModules();

    return {
      kit: new StellarWalletsKit({
        selectedWalletId: FREIGHTER_ID,
        network,
        modules,
      }),
      isWalletConnectAvailable: wcModule !== null,
    };
  });

  const isConnected = !!publicKey;
  const status = isConnecting
    ? "connecting"
    : isConnected
      ? "connected"
      : "disconnected";

  const commitWalletConnection = useCallback(
    (walletId: string, address: string, clearPrivySession: boolean) => {
      setPublicKey(address);
      setActiveWalletId(walletId);
      localStorage.setItem("stellar_address", address);
      localStorage.setItem("stellar_last_wallet", walletId);
      localStorage.setItem("stellar_auto_connect", "true");

      if (clearPrivySession) {
        sessionStorage.removeItem("privy_user");
        sessionStorage.removeItem("username");
        setPrivyWallet(null);
      }

      sessionReplay.addBreadcrumb({
        category: "wallet",
        message: `Wallet successfully connected: ${walletId}`,
        level: "info",
        data: {
          walletId,
          address: `${address.slice(0, 4)}...${address.slice(-4)}`,
        },
      });
    },
    []
  );

  const finalizeWalletConnection = useCallback(
    (walletId: string, address: string) => {
      const storedPrivy = readStoredPrivySession();
      const activePrivy = privyWalletRef.current;

      if (activePrivy || storedPrivy.hasSession) {
        // Never silently clear Privy session state — require explicit user confirmation
        setPendingWalletSwitch({
          walletId,
          address,
          privyEmail: activePrivy?.email ?? storedPrivy.email,
          privyUsername: activePrivy?.username ?? storedPrivy.username,
        });
        return;
      }

      commitWalletConnection(walletId, address, false);
    },
    [commitWalletConnection]
  );

  const confirmWalletSwitch = useCallback(() => {
    setPendingWalletSwitch(current => {
      if (!current) {
        return null;
      }
      commitWalletConnection(current.walletId, current.address, true);
      return null;
    });
  }, [commitWalletConnection]);

  const cancelWalletSwitch = useCallback(() => {
    setPendingWalletSwitch(null);
  }, []);

  const getAddressWithWalletConnectRetry = useCallback(
    async (walletId: string) => {
      let lastError: unknown;
      const maxAttempts =
        walletId === WALLET_CONNECT_ID ? WC_INIT_RETRY_ATTEMPTS : 1;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          return await kit.getAddress();
        } catch (err) {
          lastError = err;
          if (
            walletId === WALLET_CONNECT_ID &&
            isWalletConnectNotReadyError(err) &&
            attempt < maxAttempts - 1
          ) {
            await new Promise(resolve =>
              setTimeout(resolve, WC_INIT_RETRY_DELAY_MS)
            );
            continue;
          }
          throw err;
        }
      }

      throw lastError;
    },
    [kit]
  );

  const connect = useCallback(async () => {
    sessionReplay.addBreadcrumb({
      category: "wallet",
      message: "Opening wallet connection modal",
      level: "info",
    });
    setIsConnecting(true);
    setError(null);
    try {
      await kit.openModal({
        onWalletSelected: async wallet => {
          sessionReplay.addBreadcrumb({
            category: "wallet",
            message: `Wallet selected from modal: ${wallet.id}`,
            level: "info",
            data: { walletId: wallet.id, name: wallet.name },
          });
          kit.setWallet(wallet.id);
          const { address } = await getAddressWithWalletConnectRetry(wallet.id);
          finalizeWalletConnection(wallet.id, address);
          setIsConnecting(false);
        },
        onClosed: err => {
          if (isDev) {
            // eslint-disable-next-line no-console
            console.debug(
              "[StellarWallet] Modal closed",
              err ? String(err) : ""
            );
          }
          sessionReplay.addBreadcrumb({
            category: "wallet",
            message: "Wallet selection modal closed",
            level: "info",
            data: { error: err ? String(err) : undefined },
          });
          setIsConnecting(false);
        },
      });
    } catch (err) {
      if (isDev) {
        // eslint-disable-next-line no-console
        console.error("Failed to connect Stellar wallet:", err);
      }
      sessionReplay.recordFlowError("wallet", err, { action: "openModal" });
      setError("Failed to connect wallet");
      setIsConnecting(false);
    }
  }, [finalizeWalletConnection, getAddressWithWalletConnectRetry, kit]);

  const connectWallet = useCallback(
    async (walletId: string) => {
      sessionReplay.addBreadcrumb({
        category: "wallet",
        message: `Attempting direct connection to wallet: ${walletId}`,
        level: "info",
        data: { walletId },
      });

      if (walletId === WALLET_CONNECT_ID && !isWalletConnectAvailable) {
        setError(
          "Mobile QR wallet connection is not configured. Please set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID."
        );
        return;
      }

      setIsConnecting(true);
      setError(null);
      setUnavailableWalletId(null);
      try {
        // Set the wallet first - this initializes the wallet module
        kit.setWallet(walletId);

        // Small delay to ensure wallet is properly initialized
        // This is especially important for extension wallets
        await new Promise(resolve => setTimeout(resolve, 100));

        // For WalletConnect, getAddress opens the QR modal and resolves after
        // the mobile wallet approves the session over the WalletConnect relay.
        const result = await getAddressWithWalletConnectRetry(walletId);

        if (result && result.address) {
          finalizeWalletConnection(walletId, result.address);
        } else {
          throw new Error("No address returned from wallet");
        }
      } catch (err: any) {
        if (isDev) {
          // eslint-disable-next-line no-console
          console.error("Failed to connect Stellar wallet:", {
            walletId,
            message: err?.message,
          });
        }

        sessionReplay.recordFlowError("wallet", err, {
          walletId,
          step: "kit.getAddress",
        });

        const errorMessage =
          err?.message ||
          err?.toString() ||
          String(err) ||
          "Failed to connect wallet";

        // Check if wallet is not installed. WalletConnect is a QR bridge, not
        // an extension, so the string heuristics must not flag it.
        const supportedWallets = await kit.getSupportedWallets().catch(() => []);
        const unavailable = supportedWallets.some(
          (wallet) => wallet.id === walletId && wallet.isAvailable === false,
        );
        if (
          unavailable ||
          (walletId !== WALLET_CONNECT_ID &&
            (errorMessage.includes("not installed") ||
              errorMessage.includes("not found") ||
              errorMessage.includes("extension") ||
              errorMessage.includes("Extension not found") ||
              errorMessage.includes("Wallet not found") ||
              errorMessage.toLowerCase().includes("no provider") ||
              errorMessage.toLowerCase().includes("not available") ||
              errorMessage.toLowerCase().includes("unavailable")))
        ) {
          if (unavailable) {
            setUnavailableWalletId(walletId);
          }
          setError(
            `${walletId.charAt(0).toUpperCase() + walletId.slice(1)} wallet is not installed. Please install the extension first.`
          );
        } else if (
          errorMessage.includes("rejected") ||
          errorMessage.includes("denied") ||
          errorMessage.includes("User rejected") ||
          errorMessage.includes("cancelled") ||
          errorMessage.includes("canceled") ||
          errorMessage.includes("User cancelled") ||
          errorMessage.includes("user cancelled")
        ) {
          setError("Connection was rejected. Please try again.");
        } else if (
          errorMessage.includes("timeout") ||
          errorMessage.includes("timed out")
        ) {
          setError("Connection timed out. Please try again.");
        } else {
          // Show a more user-friendly error message
          setError(`Failed to connect ${walletId}. ${errorMessage}`);
        }
      } finally {
        setIsConnecting(false);
      }
    },
    [
      finalizeWalletConnection,
      getAddressWithWalletConnectRetry,
      isWalletConnectAvailable,
      kit,
    ]
  );

  const connectMobileWallet = useCallback(async () => {
    await connectWallet(WALLET_CONNECT_ID);
  }, [connectWallet]);

  // Attempt wallet restoration once for returning users (delayed so it doesn't
  // open the wallet popup immediately on reload and block the Connect Wallet modal).
  useEffect(() => {
    if (hasAttemptedAutoConnect.current || publicKey) {
      return;
    }

    const autoConnect = localStorage.getItem("stellar_auto_connect") === "true";
    const lastWalletId = localStorage.getItem("stellar_last_wallet");
    const cachedAddress = localStorage.getItem("stellar_address");

    if (autoConnect && cachedAddress) {
      hasAttemptedAutoConnect.current = true;
      setPublicKey(cachedAddress);
      return;
    }

    if (!autoConnect || !lastWalletId) {
      return;
    }

    if (lastWalletId === WALLET_CONNECT_ID && !isWalletConnectAvailable) {
      return;
    }

    hasAttemptedAutoConnect.current = true;
    let cancelled = false;

    const timeoutId = window.setTimeout(() => {
      const restoreConnection = async () => {
        if (cancelled) {
          return;
        }
        setIsConnecting(true);
        setError(null);
        try {
          kit.setWallet(lastWalletId);
          const { address } =
            await getAddressWithWalletConnectRetry(lastWalletId);
          if (!cancelled && address) {
            setPublicKey(address);
            setActiveWalletId(lastWalletId);
            localStorage.setItem("stellar_last_wallet", lastWalletId);
            localStorage.setItem("stellar_auto_connect", "true");
          }
        } catch (err) {
          if (!cancelled && isDev) {
            // eslint-disable-next-line no-console
            console.warn(
              "Stellar auto-connect failed:",
              err instanceof Error ? err.message : String(err)
            );
          }
        } finally {
          if (!cancelled) {
            setIsConnecting(false);
          }
        }
      };

      void restoreConnection();
    }, 800);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    getAddressWithWalletConnectRetry,
    isWalletConnectAvailable,
    kit,
    publicKey,
  ]);

  const truncatedPendingAddress = pendingWalletSwitch
    ? `${pendingWalletSwitch.address.slice(0, 6)}...${pendingWalletSwitch.address.slice(-4)}`
    : "";

  return (
    <StellarWalletContext.Provider
      value={{
        kit,
        address: publicKey,
        publicKey,
        activeWalletId,
        isConnected,
        status,
        connect,
        connectWallet,
        connectMobileWallet,
        disconnect,
        isLoading: isConnecting,
        isConnecting,
        error,
        isWalletConnectAvailable,
        unavailableWalletId,
        privyWallet,
        pendingWalletSwitch,
        confirmWalletSwitch,
        cancelWalletSwitch,
        network: activeNetwork,
        networkGuard,
        isMainnetBlocked: networkGuard.isTransactionBlocked,
      }}
    >
      {children}

      {pendingWalletSwitch && (
        <div
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={cancelWalletSwitch}
          role="dialog"
          aria-modal="true"
          aria-labelledby="wallet-switch-confirm-title"
        >
          <div
            className="relative w-full max-w-md bg-[#111114] border border-yellow-500/30 rounded-2xl p-6 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
                <h2
                  id="wallet-switch-confirm-title"
                  className="text-white text-base font-semibold"
                >
                  Clear Privy Session &amp; Switch Wallet?
                </h2>
              </div>
              <button
                type="button"
                onClick={cancelWalletSwitch}
                aria-label="Cancel wallet switch"
                className="text-white/40 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-xl border border-yellow-500/25 bg-yellow-500/10 p-3.5 text-xs text-yellow-200 leading-relaxed space-y-1.5">
              <p>
                You are currently signed in with your Privy session
                {pendingWalletSwitch.privyEmail
                  ? ` (${pendingWalletSwitch.privyEmail})`
                  : pendingWalletSwitch.privyUsername
                    ? ` (@${pendingWalletSwitch.privyUsername})`
                    : ""}
                .
              </p>
              <p>
                Switching to Stellar wallet{" "}
                <code className="font-mono text-white">
                  {truncatedPendingAddress}
                </code>{" "}
                will clear your stored Privy session and username from this
                browser session.
              </p>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={cancelWalletSwitch}
                className="flex-1 bg-white/[0.08] hover:bg-white/[0.14] text-white text-sm font-medium py-2.5 px-4 rounded-xl transition-colors"
              >
                Keep Current Session
              </button>
              <button
                type="button"
                onClick={confirmWalletSwitch}
                className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-semibold py-2.5 px-4 rounded-xl transition-colors"
              >
                Switch Wallet
              </button>
            </div>
          </div>
        </div>
      )}
    </StellarWalletContext.Provider>
  );
}
