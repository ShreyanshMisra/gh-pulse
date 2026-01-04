'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface LiveStats {
  events_per_min: number;
  active_repos: number;
  total_events: number;
  top_language: string | null;
}

export interface TrendingItem {
  repo_name: string;
  stars_gained: number;
  velocity: number;
}

export interface WebSocketMessage {
  type: 'update' | 'ping';
  timestamp?: string;
  stats?: LiveStats;
  trending?: TrendingItem[];
}

interface UseWebSocketOptions {
  onMessage?: (data: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  stats: LiveStats | null;
  trending: TrendingItem[];
  lastUpdate: Date | null;
  reconnect: () => void;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws';

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    // Don't connect if already connected or connecting
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    try {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);

          // Handle ping
          if (data.type === 'ping') {
            ws.send('pong');
            return;
          }

          // Handle update
          if (data.type === 'update') {
            if (data.stats) {
              setStats(data.stats);
            }
            if (data.trending) {
              setTrending(data.trending);
            }
            if (data.timestamp) {
              setLastUpdate(new Date(data.timestamp));
            }
            onMessage?.(data);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        onDisconnect?.();

        // Attempt reconnection
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          const delay = reconnectInterval * Math.min(reconnectAttemptsRef.current, 5);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError?.(error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }, [onConnect, onDisconnect, onError, onMessage, reconnectInterval, maxReconnectAttempts]);

  const reconnect = useCallback(() => {
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Reset attempts and connect
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Send periodic pings to keep connection alive
  useEffect(() => {
    if (!isConnected) return;

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send('ping');
      }
    }, 30000);

    return () => clearInterval(pingInterval);
  }, [isConnected]);

  return {
    isConnected,
    stats,
    trending,
    lastUpdate,
    reconnect,
  };
}
