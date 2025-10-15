"use client";
import { Context } from "@/components/providers/ContextProvider";
import { useCallback, useContext, useEffect, useRef, useState } from "react";

export function useWebSocket(onMessage: (data: any) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const { user } = useContext(Context);

  useEffect(() => {
    if (!user?.token) {
      return;
    }

    const wsUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "ws://localhost:8080";
    const fullUrl = `${wsUrl}?token=${user.token}`;

    const socket = new WebSocket(fullUrl);
    ws.current = socket;

    socket.onopen = () => {
      console.log("WebSocket connected");
      setIsConnected(true);
    };

    socket.onclose = (event) => {
      console.log("WebSocket disconnected:", event.code, event.reason);
      setIsConnected(false);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Received message:", data);

        onMessage(data);
      } catch (error) {
        console.error("Failed to parse message:", error);
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close();
      }
    };
  }, [user?.token]); // Add dependencies

  const send = useCallback((data: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    } else {
      console.error(
        "WebSocket is not connected. ReadyState:",
        ws.current?.readyState
      );
      throw new Error("WebSocket is not connected");
    }
  }, []);

  return { send, isConnected, ws: ws.current };
}
