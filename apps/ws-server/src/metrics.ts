import { Counter, Gauge, Registry, collectDefaultMetrics } from "prom-client";

export const metricsRegistry = new Registry();

collectDefaultMetrics({ register: metricsRegistry, prefix: "collabdraw_ws_" });

export const activeWebSocketConnections = new Gauge({
  name: "collabdraw_websocket_active_connections",
  help: "Number of active WebSocket connections handled by this pod.",
  registers: [metricsRegistry],
});

export const webSocketEvents = new Counter({
  name: "collabdraw_websocket_events_total",
  help: "WebSocket events processed by event type and delivery source.",
  labelNames: ["type", "source"] as const,
  registers: [metricsRegistry],
});

export const redisPubSubMessages = new Counter({
  name: "collabdraw_redis_pubsub_messages_total",
  help: "Room events published to or received from Redis Pub/Sub.",
  labelNames: ["direction"] as const,
  registers: [metricsRegistry],
});
