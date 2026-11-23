import { WalletNetwork } from "@creit.tech/stellar-wallets-kit";
import {
  WALLET_CONNECT_ID,
  WalletConnectAllowedMethods,
  WalletConnectModule,
} from "@creit.tech/stellar-wallets-kit/modules/walletconnect.module";

export { WALLET_CONNECT_ID, WalletConnectAllowedMethods, WalletConnectModule };

export interface CreateWalletConnectOptions {
  network: WalletNetwork;
  projectId?: string | null;
  onSessionDeleted?: (sessionId: string) => void;
}

export function getWalletConnectProjectId(): string | null {
  const id = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();
  return id && id.length > 0 ? id : null;
}

export function createWalletConnectModule(
  options: CreateWalletConnectOptions
): WalletConnectModule | null {
  const projectId = options.projectId ?? getWalletConnectProjectId();
  if (!projectId) {
    return null;
  }

  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://streamfi.app";

  return new WalletConnectModule({
    projectId,
    name: "StreamFi",
    description: "Decentralized live streaming on Stellar",
    url: origin,
    icons: [`${origin}/favicon.ico`],
    method: WalletConnectAllowedMethods.SIGN,
    network: options.network,
    onSessionDeleted: options.onSessionDeleted,
  });
}

export function isWalletConnectNotReadyError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message)
        : String(error ?? "");
  return message.toLowerCase().includes("walletconnect is not running yet");
}
