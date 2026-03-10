"use client";

import { usePrivy } from "@privy-io/react-auth";

type PrivyAuth = {
  signInWithGoogle: () => void;
  ready: boolean;
  authenticated: boolean;
  logout: () => Promise<void>;
  user: ReturnType<typeof usePrivy>["user"];
};

export function usePrivyAuth(): PrivyAuth {
  const { ready, authenticated, login, logout, user } = usePrivy();

  return {
    signInWithGoogle: login,
    ready,
    authenticated,
    logout,
    user,
  };
}
