"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";

interface StellarWalletContextValue {
  isConnected: boolean;
  address: string | null;
  connect: () => void;
  disconnect: () => void;
  isLoading: boolean;
}

const noop = () => {};

const StellarWalletContext = createContext<StellarWalletContextValue>({
  isConnected: false,
  address: null,
  connect: noop,
  disconnect: noop,
  isLoading: false,
});

const STORAGE_KEY = "stellar-wallet-id";

async function loadKit() {
  const { StellarWalletsKit, WalletNetwork, allowAllModules, FREIGHTER_ID } =
    await import("@creit.tech/stellar-wallets-kit");

  return new StellarWalletsKit({
    network: WalletNetwork.PUBLIC,
    selectedWalletId: FREIGHTER_ID,
    modules: allowAllModules(),
  });
}

export function StellarWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kitRef = useRef<any>(null);
  const modalOpenRef = useRef(false);

  const getKit = useCallback(async () => {
    if (!kitRef.current) {
      kitRef.current = await loadKit();
    }
    return kitRef.current;
  }, []);

  useEffect(() => {
    const savedWalletId = localStorage.getItem(STORAGE_KEY);
    if (!savedWalletId) {
      return;
    }

    setIsLoading(true);

    getKit()
      .then((kit: any) => {
        kit.setWallet(savedWalletId);
        return kit.getAddress();
      })
      .then(({ address: addr }: { address: string }) => {
        setAddress(addr);
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [getKit]);

  const connect = useCallback(async () => {
    if (modalOpenRef.current) {
      return;
    }

    const kit = await getKit();
    modalOpenRef.current = true;
    setIsLoading(true);

    kit.openModal({
      onWalletSelected: async (option: { id: string }) => {
        modalOpenRef.current = false;
        try {
          kit.setWallet(option.id);
          const { address: addr } = await kit.getAddress();
          localStorage.setItem(STORAGE_KEY, option.id);
          setAddress(addr);
        } catch (error) {
          console.error("Stellar wallet connection failed:", error);
        } finally {
          setIsLoading(false);
        }
      },
      onClosed: () => {
        modalOpenRef.current = false;
        setIsLoading(false);
      },
    });
  }, [getKit]);

  const disconnect = useCallback(async () => {
    const kit = await getKit();
    try {
      await kit.disconnect();
    } catch {
      // not all modules implement disconnect
    }
    localStorage.removeItem(STORAGE_KEY);
    setAddress(null);
  }, [getKit]);

  const value: StellarWalletContextValue = {
    isConnected: address !== null,
    address,
    connect,
    disconnect,
    isLoading,
  };

  return (
    <StellarWalletContext.Provider value={value}>
      {children}
    </StellarWalletContext.Provider>
  );
}

export function useStellarWallet(): StellarWalletContextValue {
  return useContext(StellarWalletContext);
}
