import { createClient, RedisClientType } from "redis";
import { randomUUID } from "crypto";
import { redisPubSubMessages } from "./metrics";

const channel = "collabdraw:rooms";
const redisUrl = process.env.REDIS_URL;

export const serverInstanceId = process.env.SERVER_INSTANCE_ID ?? randomUUID();

type RoomEventHandler = (event: Record<string, unknown>) => void;

let publisher: RedisClientType | undefined;
let subscriber: RedisClientType | undefined;
let ready = false;

/**
 * Connects a single Redis publisher/subscriber pair for this pod. Redis is
 * deliberately optional in development so a local canvas still works without
 * cross-pod fan-out; production readiness checks make it a required service.
 */
export async function startRedisFanout(onEvent: RoomEventHandler) {
  if (!redisUrl || ready) return;

  publisher = createClient({ url: redisUrl });
  subscriber = publisher.duplicate();

  const reportError = (role: string) => (error: Error) => {
    ready = false;
    console.error(`Redis ${role} error:`, error.message);
  };

  publisher.on("error", reportError("publisher"));
  subscriber.on("error", reportError("subscriber"));

  try {
    await Promise.all([publisher.connect(), subscriber.connect()]);
    await subscriber.subscribe(channel, (raw) => {
      try {
        const event = JSON.parse(raw) as Record<string, unknown>;
        if (event.originServerId === serverInstanceId) return;
        redisPubSubMessages.inc({ direction: "received" });
        onEvent(event);
      } catch (error) {
        console.error("Ignoring malformed Redis room event", error);
      }
    });
    ready = true;
    console.log(`Redis Pub/Sub connected as ${serverInstanceId}`);
  } catch (error) {
    ready = false;
    console.error("Redis fan-out unavailable; serving local room broadcasts only", error);
  }
}

export async function publishRoomEvent(event: Record<string, unknown>) {
  if (!ready || !publisher) return;
  try {
    await publisher.publish(
      channel,
      JSON.stringify({ ...event, originServerId: serverInstanceId }),
    );
    redisPubSubMessages.inc({ direction: "published" });
  } catch (error) {
    ready = false;
    console.error("Failed to publish room event", error);
  }
}

export function isRedisReady() {
  return ready;
}
