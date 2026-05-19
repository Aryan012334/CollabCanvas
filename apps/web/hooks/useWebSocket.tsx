"use client";
import { Context } from "@/components/providers/ContextProvider";
import { useCallback, useContext, useEffect, useRef, useState } from "react";

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

export function useWebSocket(onMessage: (data: any) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const { user } = useContext(Context);
  const onMessageRef = useRef(onMessage);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!user?.token) return;

    function connect() {
      if (!isMounted.current) return;

      if (
        ws.current?.readyState === WebSocket.OPEN ||
        ws.current?.readyState === WebSocket.CONNECTING
      ) {
        return;
      }

      const wsUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "ws://localhost:4000";
      const fullUrl = `${wsUrl}?token=${user.token}`;

      console.log(" Creating new WebSocket connection", fullUrl);
      const socket = new WebSocket(fullUrl);
      ws.current = socket;

      socket.onopen = () => {
        if (!isMounted.current) return;
        console.log(" WebSocket connected");
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      socket.onclose = (event) => {
        if (!isMounted.current) return;
        console.log(" WebSocket disconnected:", event.code, event.reason);
        setIsConnected(false);

        // Don't reconnect on intentional close (1000) or auth failure (4002)
        if (event.code === 1000 || event.code === 4002) return;

        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts.current += 1;
          const delay = RECONNECT_DELAY_MS * reconnectAttempts.current;
          console.log(
            ` Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})`
          );
          reconnectTimer.current = setTimeout(connect, delay);
        } else {
          console.warn(" Max reconnect attempts reached");
        }
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current(data);
        } catch (error) {
          console.log("Failed to parse message:", error);
        }
      };

      socket.onerror = (error) => {
        console.log("WebSocket error:", error);
      };
    }

    connect();

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      const socket = ws.current;
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close(1000, "Component unmounting");
      }
    };
  }, [user?.token]);

  const send = useCallback((data: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    } else {
      console.warn("WebSocket not ready, message dropped:", data);
    }
  }, []);

  return { send, isConnected, ws: ws.current };
}
