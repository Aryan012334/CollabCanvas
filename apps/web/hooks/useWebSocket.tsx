"use client";
import { Context } from "@/components/providers/ContextProvider";
import { useCallback, useContext, useEffect, useRef, useState } from "react";

export function useWebSocket(onMessage: (data: any) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const { user } = useContext(Context);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!user?.token) {
      return;
    }

    if (
      ws.current?.readyState === WebSocket.OPEN ||
      ws.current?.readyState === WebSocket.CONNECTING
    ) {
      console.log(" WebSocket already exists, skipping duplicate connection");
      return;
    }

    const wsUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "ws://localhost:8080";
    const fullUrl = `${wsUrl}?token=${user.token}`;

    console.log(" Creating new WebSocket connection", fullUrl);
    const socket = new WebSocket(fullUrl);
    ws.current = socket;

    socket.onopen = () => {
      console.log(" WebSocket connected");
      setIsConnected(true);
    };

    socket.onclose = (event) => {
      console.log(" WebSocket disconnected:", event.code, event.reason);
      setIsConnected(false);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(" Received message:", data);
        onMessageRef.current(data); // Use ref instead of callback
      } catch (error) {
        console.log("Failed to parse message:", error);
      }
    };

    socket.onerror = (error) => {
      console.log("WebSocket error:", error);
    };

    return () => {
      console.log(" Cleaning up WebSocket");
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close(1000, "Component unmounting");
      }
    };
  }, [user?.token]);

  const send = useCallback((data: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      console.log(" Sending message:", data);
      ws.current.send(JSON.stringify(data));
    } else {
      console.warn("WebSocket not ready, queueing message:", data);
    }
  }, []);

  return { send, isConnected, ws: ws.current };
}
