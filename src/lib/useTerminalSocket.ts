import { useEffect, useRef, useCallback } from "react";
import type { ServerMessage, ClientMessage } from "./ws-protocol";

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error" | "local";

interface UseTerminalSocketOptions {
  enabled: boolean;          // false = local fallback mode
  cols: number;
  rows: number;
  tier?: string;             // billing tier for container resource limits
  userId?: string;           // wallet address for session tracking
  onOutput: (data: string) => void;
  onStatusChange: (status: ConnectionStatus) => void;
  onError?: (message: string) => void;
}

const WS_BASE = (() => {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  // In dev, Vite proxies /ws to the backend. In production, same origin.
  return `${proto}//${window.location.host}`;
})();

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];

export function useTerminalSocket({
  enabled,
  cols,
  rows,
  tier,
  userId,
  onOutput,
  onStatusChange,
  onError,
}: UseTerminalSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const cleanup = useCallback(() => {
    if (pingTimer.current) {
      clearInterval(pingTimer.current);
      pingTimer.current = null;
    }
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      if (wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !mountedRef.current) return;

    cleanup();
    onStatusChange("connecting");

    const params = new URLSearchParams({ cols: String(cols), rows: String(rows) });
    if (tier) params.set("tier", tier);
    if (userId) params.set("userId", userId);
    const url = `${WS_BASE}/ws/terminal?${params}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      reconnectAttempt.current = 0;
      onStatusChange("connected");

      // Ping every 30s to keep connection alive
      pingTimer.current = setInterval(() => {
        send({ type: "ping" });
      }, 30_000);
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      const msg: ServerMessage | null = (() => {
        try { return JSON.parse(event.data as string); } catch { return null; }
      })();
      if (!msg) return;

      switch (msg.type) {
        case "output":
          onOutput(msg.data);
          break;
        case "connected":
          console.log("[ws] Container ready:", msg.containerId);
          break;
        case "error":
          console.error("[ws] Server error:", msg.message);
          onError?.(msg.message);
          break;
        case "closed":
          onStatusChange("disconnected");
          break;
        case "pong":
          // keep-alive ack
          break;
      }
    };

    ws.onclose = (event) => {
      if (!mountedRef.current) return;
      cleanup();
      onStatusChange("disconnected");

      // Auto-reconnect with backoff (unless intentionally closed)
      if (event.code !== 1000 && enabled) {
        const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt.current, RECONNECT_DELAYS.length - 1)];
        reconnectAttempt.current++;
        console.log(`[ws] Reconnecting in ${delay}ms (attempt ${reconnectAttempt.current})`);
        reconnectTimer.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      onStatusChange("error");
    };
  }, [enabled, cols, rows, cleanup, send, onOutput, onStatusChange, onError]);

  // Connect on mount / when enabled changes
  useEffect(() => {
    mountedRef.current = true;
    if (enabled) {
      connect();
    } else {
      onStatusChange("local");
    }
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [enabled, connect, cleanup, onStatusChange]);

  // Handle resize
  useEffect(() => {
    if (enabled) {
      send({ type: "resize", cols, rows });
    }
  }, [enabled, cols, rows, send]);

  return { send };
}
