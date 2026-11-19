"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRealtimeChannel } from "@/hooks/useRealtime";

export interface ExtensionConfig {
  id: string;
  name: string;
  position: "overlay" | "panel";
  config: Record<string, any>;
  isEnabled: boolean;
}

interface SandboxedExtensionOverlayProps {
  playbackId: string;
  extensions: ExtensionConfig[];
  currentViewers?: number;
  streamUptimeSeconds?: number;
  onKillExtension?: (extensionId: string) => void;
}

/**
 * Sandboxed Extension Overlay Component (#1445)
 *
 * Enforces a strict execution boundary:
 *  - Iframe attribute sandbox="allow-scripts" (no allow-same-origin, no allow-top-navigation)
 *  - PostMessage RPC protocol with capability permissions
 *  - Strips all viewer PII and ambient cookie/DOM access
 *  - Supports platform & creator emergency kill-switch
 */
export function SandboxedExtensionOverlay({
  playbackId,
  extensions,
  currentViewers = 0,
  streamUptimeSeconds = 0,
  onKillExtension,
}: SandboxedExtensionOverlayProps) {
  const iframeRefs = useRef<Map<string, HTMLIFrameElement>>(new Map());
  const [activeExtensions, setActiveExtensions] = useState<ExtensionConfig[]>(
    extensions.filter((e) => e.isEnabled && e.position === "overlay")
  );

  useEffect(() => {
    setActiveExtensions(
      extensions.filter((e) => e.isEnabled && e.position === "overlay")
    );
  }, [extensions]);

  // Listen for realtime overlay kill-switch events
  useRealtimeChannel(
    playbackId ? `stream:${playbackId}:overlay` : null,
    useCallback(
      (msg) => {
        if (msg.event === "extension:kill" && msg.data?.extensionId) {
          const killedId = msg.data.extensionId;
          setActiveExtensions((curr) => curr.filter((e) => e.id !== killedId));
          if (onKillExtension) {
            onKillExtension(killedId);
          }
        }
      },
      [onKillExtension]
    )
  );

  // Controlled postMessage RPC listener
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate RPC message format
      if (
        !event.data ||
        event.data.protocol !== "STREAMFI_EXTENSION_RPC_V1" ||
        !event.data.extensionId
      ) {
        return;
      }

      const { extensionId, requestId, action } = event.data;
      const iframe = iframeRefs.current.get(extensionId);
      if (!iframe || !iframe.contentWindow) {
        return;
      }

      // Handle scoped capabilities
      switch (action) {
        case "GET_STREAM_STATS":
          iframe.contentWindow.postMessage(
            {
              protocol: "STREAMFI_EXTENSION_RPC_V1",
              requestId,
              ok: true,
              data: {
                viewers: currentViewers,
                uptime: streamUptimeSeconds,
              },
            },
            "*"
          );
          break;

        case "PING":
          iframe.contentWindow.postMessage(
            {
              protocol: "STREAMFI_EXTENSION_RPC_V1",
              requestId,
              ok: true,
              data: { pong: Date.now() },
            },
            "*"
          );
          break;

        default:
          iframe.contentWindow.postMessage(
            {
              protocol: "STREAMFI_EXTENSION_RPC_V1",
              requestId,
              ok: false,
              error: `Unsupported action: ${action}`,
            },
            "*"
          );
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [currentViewers, streamUptimeSeconds]);

  if (activeExtensions.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {activeExtensions.map((ext) => {
        const srcDoc = generateSandboxedHtml(ext);
        return (
          <iframe
            key={ext.id}
            ref={(el) => {
              if (el) iframeRefs.current.set(ext.id, el);
              else iframeRefs.current.delete(ext.id);
            }}
            title={`Extension: ${ext.name}`}
            sandbox="allow-scripts"
            srcDoc={srcDoc}
            className="w-full h-full border-0 pointer-events-auto bg-transparent"
          />
        );
      })}
    </div>
  );
}

/**
 * Generate minimal, sandboxed HTML wrapper for built-in extension widgets.
 */
function generateSandboxedHtml(ext: ExtensionConfig): string {
  const configJson = JSON.stringify(ext.config || {});

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { margin: 0; padding: 12px; font-family: -apple-system, sans-serif; color: #fff; background: transparent; }
    .widget-container { pointer-events: auto; }
    .tip-alert { background: rgba(16, 185, 129, 0.85); border-radius: 8px; padding: 10px 16px; font-weight: bold; width: fit-content; }
    .poll-box { background: rgba(24, 24, 27, 0.85); border: 1px solid #3f3f46; border-radius: 8px; padding: 12px; width: 220px; }
    .chat-box { background: rgba(0,0,0,0.6); border-radius: 6px; padding: 8px; max-width: 280px; font-size: 13px; }
  </style>
</head>
<body>
  <div id="root" class="widget-container"></div>
  <script>
    const extName = ${JSON.stringify(ext.name)};
    const extConfig = ${configJson};
    const root = document.getElementById('root');

    if (extName === 'Tip Alert') {
      root.innerHTML = '<div class="tip-alert">✨ Tip Alert Active</div>';
    } else if (extName === 'Poll Widget') {
      root.innerHTML = '<div class="poll-box"><div style="font-size: 13px; margin-bottom: 6px;">📊 Live Audience Poll</div><div style="font-size: 11px; opacity: 0.8;">Waiting for streamer...</div></div>';
    } else {
      root.innerHTML = '<div class="chat-box">💬 Overlay Widget Loaded</div>';
    }

    // Ping host via RPC
    window.parent.postMessage({
      protocol: 'STREAMFI_EXTENSION_RPC_V1',
      extensionId: ${JSON.stringify(ext.id)},
      requestId: 'init-ping',
      action: 'GET_STREAM_STATS'
    }, '*');
  </script>
</body>
</html>
  `;
}
