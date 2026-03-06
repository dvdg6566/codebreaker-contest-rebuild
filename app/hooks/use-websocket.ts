import { useEffect, useRef, useState, useCallback } from "react";

/**
 * WebSocket message from the server
 */
export interface WebSocketMessage {
  messageType: "announce" | "postClarification" | "answerClarification";
  payload: Record<string, unknown>;
  timestamp: string;
}

/**
 * Identity message sent on connection
 */
interface IdentityMessage {
  action: "identity";
  accountRole: string;
  username: string;
}

/**
 * WebSocket connection options
 */
interface UseWebSocketOptions {
  /** WebSocket endpoint URL */
  url: string | null;
  /** User's account role */
  accountRole: string;
  /** User's username */
  username: string;
  /** Whether to connect (defaults to true if url is provided) */
  enabled?: boolean;
  /** Callback when a message is received */
  onMessage?: (message: WebSocketMessage) => void;
}

/**
 * WebSocket connection state
 */
interface WebSocketState {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  error: string | null;
}

// Reconnection constants
const MIN_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 32000; // 32 seconds
const RECONNECT_MULTIPLIER = 2;

/**
 * Custom hook for managing WebSocket connections with automatic reconnection
 *
 * Features:
 * - Sends identity on connection (accountRole, username)
 * - Exponential backoff reconnection (1s, 2s, 4s... max 32s)
 * - Automatic cleanup on unmount
 */
export function useWebSocket(options: UseWebSocketOptions): WebSocketState {
  const { url, accountRole, username, enabled = true, onMessage } = options;

  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    lastMessage: null,
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(MIN_RECONNECT_DELAY);
  const mountedRef = useRef(true);
  const onMessageRef = useRef(onMessage);

  // Keep onMessage callback ref up to date
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!url || !enabled || !mountedRef.current) {
      return;
    }

    // Clear any pending reconnect
    clearReconnectTimeout();

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;

        setState((prev) => ({ ...prev, isConnected: true, error: null }));

        // Reset reconnect delay on successful connection
        reconnectDelayRef.current = MIN_RECONNECT_DELAY;

        // Send identity message
        const identityMessage: IdentityMessage = {
          action: "identity",
          accountRole,
          username,
        };
        ws.send(JSON.stringify(identityMessage));
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;

        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          setState((prev) => ({ ...prev, lastMessage: message }));
          onMessageRef.current?.(message);
        } catch (err) {
          console.error("[WebSocket] Failed to parse message:", err);
        }
      };

      ws.onerror = (event) => {
        console.error("[WebSocket] Error:", event);
        if (!mountedRef.current) return;
        setState((prev) => ({ ...prev, error: "WebSocket error occurred" }));
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;

        setState((prev) => ({ ...prev, isConnected: false }));
        wsRef.current = null;

        // Schedule reconnection with exponential backoff
        if (enabled && mountedRef.current) {
          const delay = reconnectDelayRef.current;
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connect();
            }
          }, delay);

          // Increase delay for next reconnect attempt (exponential backoff)
          reconnectDelayRef.current = Math.min(
            reconnectDelayRef.current * RECONNECT_MULTIPLIER,
            MAX_RECONNECT_DELAY
          );
        }
      };
    } catch (err) {
      console.error("[WebSocket] Failed to create connection:", err);
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Failed to connect",
      }));
    }
  }, [url, accountRole, username, enabled, clearReconnectTimeout]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    mountedRef.current = true;

    if (url && enabled) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      clearReconnectTimeout();

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [url, enabled, connect, clearReconnectTimeout]);

  return state;
}
