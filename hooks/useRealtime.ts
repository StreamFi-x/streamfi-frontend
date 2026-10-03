/**
 * hooks/useRealtime.ts
 *
 * React hook for subscribing to realtime channels with automatic cleanup
 * and connection state tracking.
 */

import { useEffect, useState, useCallback } from "react";
import {
  getGlobalRealtimeClient,
  ConnectionState,
} from "@/lib/realtime/client";
import { RealtimeMessage } from "@/lib/realtime/pubsub";

export function useRealtimeChannel(
  channel: string | null | undefined,
  onMessage?: (msg: RealtimeMessage) => void
) {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");

  useEffect(() => {
    const client = getGlobalRealtimeClient();
    const unsubState = client.onStateChange(setConnectionState);

    if (!channel) {
      return unsubState;
    }

    const unsubChannel = client.subscribe(channel, (msg) => {
      if (onMessage) {
        onMessage(msg);
      }
    });

    return () => {
      unsubState();
      unsubChannel();
    };
  }, [channel, onMessage]);

  const reconnect = useCallback(() => {
    getGlobalRealtimeClient().reconnect();
  }, []);

  return {
    connectionState,
    reconnect,
  };
}
