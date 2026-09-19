import { WS_URL } from "./config";
import { SocketEvent } from "./types";

export function openRoomSocket(token: string, onEvent: (event: SocketEvent) => void) {
  const socket = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
  socket.onmessage = (message) => {
    try {
      onEvent(JSON.parse(message.data as string) as SocketEvent);
    } catch {
      onEvent({ type: "error", message: "Received invalid server data" });
    }
  };
  return socket;
}
