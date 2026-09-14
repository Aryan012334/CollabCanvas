import { User, rooms } from "../state";
import { prismaClient as prisma } from "@repo/db/client";
import WebSocket from "ws";
import { ShapeType } from "@repo/db/client";
import { Job } from "../utils/auth";
import { publishRoomEvent } from "../redis";
import { webSocketEvents } from "../metrics";

const queue: {
  job: Job;
  resolve: (v: any) => void;
  reject: (e: any) => void;
  retries: number;
}[] = [];
let processing = false;

// --- Enqueue with Promise ---
export function enqueue(job: Job): Promise<any> {
  return new Promise((resolve, reject) => {
    queue.push({ job, resolve, reject, retries: 0 });
    processQueue();
  });
}

// --- Process Queue ---
async function processQueue() {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const item = queue.shift()!;
    const { job, resolve, reject } = item;
    try {
      let result;

      if (job.type === "chat") {
        result = await prisma.chat.create({
          data: {
            roomId: Number(job.roomId),
            userId: job.userId,
            message: job.payload.message,
          },
        });
      } else if (job.type === "shape:create") {
        result = await prisma.shape.create({
          data: {
            roomId: Number(job.roomId),
            userId: job.userId,
            type: ShapeType[job.payload.type as keyof typeof ShapeType],
            strokeColor: job.payload.strokeColor ?? "black",
            fillColor: job.payload.fillColor ?? "transparent",
            strokeWidth: job.payload.strokeWidth ?? 1,
            strokeStyle: job.payload.strokeStyle ?? "solid",
            fillStyle: job.payload.fillStyle ?? "solid",
            points: job.payload.points ?? [],
            text: job.payload.text ?? "",
            fontSize: job.payload.fontSize ?? 12,
            startX: job.payload.startX ?? 0,
            startY: job.payload.startY ?? 0,
            width: job.payload.width ?? 0,
            height: job.payload.height ?? 0,
          },
        });
      } else if (job.type === "shape:update") {
        result = await prisma.shape.update({
          where: { roomId: Number(job.roomId), id: job.payload.id },
          data: {
            startX: job.payload.startX,
            startY: job.payload.startY,
            width: job.payload.width,
            height: job.payload.height,
            type: job.payload.type
              ? ShapeType[job.payload.type as keyof typeof ShapeType]
              : undefined,
            strokeColor: job.payload.strokeColor,
            fillColor: job.payload.fillColor,
            strokeWidth: job.payload.strokeWidth,
            strokeStyle: job.payload.strokeStyle,
            fillStyle: job.payload.fillStyle,
            points: job.payload.points,
            text: job.payload.text,
            fontSize: job.payload.fontSize,
          },
        });
      }

      resolve(result);
    } catch (err) {
      console.error("DB write failed:", err);
      const MAX_RETRIES = 3;
      if (item.retries < MAX_RETRIES) {
        item.retries += 1;
        queue.unshift(item); // re-queue at front with incremented retry count
        await new Promise((r) => setTimeout(r, 1000 * item.retries)); // backoff
      } else {
        console.error(`Job failed after ${MAX_RETRIES} retries, dropping:`, item.job);
        item.reject(err);
      }
    }
  }

  processing = false;
}

export async function handleEvent(user: User, data: any) {
  // Normalize roomId to string for consistent Map key lookups
  const roomId = String(data.roomId);

  switch (data.type) {
    case "join-room": {
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
      }
      const room = rooms.get(roomId);

      if (!room) {
        console.log("room not found");
        return;
      }
      room.add(user);

      // notify other users
      room.forEach((u) => {
        if (u.ws !== user.ws)
          u.ws.send(
            JSON.stringify({ type: "user_joined", userId: user?.name }),
          );
      });
      break;
    }

    case "leave-room": {
      const room = rooms.get(roomId);
      if (room && room.has(user)) {
        room.delete(user);

        // Notify remaining users
        room.forEach((u) => {
          if (u.ws.readyState === WebSocket.OPEN) {
            u.ws.send(
              JSON.stringify({
                type: "user_left",
                userId: user.userId,
                username: user.name,
                roomId: roomId,
              }),
            );
          }
        });

        if (room.size === 0) {
          rooms.delete(roomId);
        }

        console.log(`User ${user.name} left room ${roomId} gracefully`);
      }
      break;
    }

    case "chat": {
      // broadcast immediately
      const room = rooms.get(roomId);
      if (room) {
        room.forEach((u) =>
          u.ws.send(
            JSON.stringify({
              type: "chat",
              message: data.message,
              roomId: roomId,
              userId: user.userId,
              username: user.name,
            }),
          ),
        );
      }

      // enqueue DB write
      enqueue({
        type: "chat",
        roomId: roomId,
        userId: user.userId,
        payload: { message: data.message },
      });
      await publishRoomEvent({
        type: "chat",
        message: data.message,
        roomId,
        userId: user.userId,
        username: user.name,
      });
      webSocketEvents.inc({ type: "chat", source: "client" });
      break;
    }

    case "shape:create": {
      const room = rooms.get(roomId);

      // Broadcast immediately with a temporary id so peers see it
      // instantly — don't wait for the DB write.
      const tempId = Date.now();
      if (room) {
        room.forEach((u) => {
          if (u.ws.readyState === WebSocket.OPEN) {
            u.ws.send(JSON.stringify({
              type: "shape:create",
              shape: { ...data.shape, id: tempId },
              roomId,
              userId: user.userId,
              username: user.name,
            }));
          }
        });
      }

      // Persist to DB asynchronously — if it fails, log and move on.
      // The process must NOT crash on a DB error.
      enqueue({
        type: "shape:create",
        roomId,
        userId: user.userId,
        payload: data.shape,
      }).then((createdShape) => {
        // Send a follow-up to replace the tempId with the real DB id
        if (room) {
          room.forEach((u) => {
            if (u.ws.readyState === WebSocket.OPEN) {
              u.ws.send(JSON.stringify({
                type: "shape:id_assigned",
                tempId,
                realId: createdShape.id,
                roomId,
              }));
            }
          });
        }
        publishRoomEvent({
          type: "shape:create",
          shape: { ...data.shape, id: createdShape.id },
          roomId,
          userId: user.userId,
          username: user.name,
        }).catch((e) => console.error("Redis publish failed:", e));
      }).catch((err) => {
        console.error("shape:create DB write failed permanently, shape was broadcast but not persisted:", err);
        // Notify sender so they know persistence failed
        if (user.ws.readyState === WebSocket.OPEN) {
          user.ws.send(JSON.stringify({
            type: "error",
            message: "Shape could not be saved — room may not exist in the database.",
            tempId,
          }));
        }
      });

      webSocketEvents.inc({ type: "shape:create", source: "client" });
      break;
    }

    case "shape:update": {
      const room = rooms.get(roomId);

      // Broadcast immediately — peers see the update instantly
      if (room) {
        room.forEach((u) =>
          u.ws.send(JSON.stringify({
            type: "shape:update",
            shape: data.shape,
            roomId,
            userId: user.userId,
            username: user.name,
          }))
        );
      }

      // Persist asynchronously — never block broadcast on DB
      enqueue({
        type: "shape:update",
        roomId,
        userId: user.userId,
        payload: data.shape,
      }).then((updatedShape) => {
        publishRoomEvent({
          type: "shape:update",
          shape: { ...data.shape, id: updatedShape.id },
          roomId,
          userId: user.userId,
          username: user.name,
        }).catch((e) => console.error("Redis publish failed:", e));
      }).catch((err) => {
        console.error("shape:update DB write failed permanently:", err);
      });

      webSocketEvents.inc({ type: "shape:update", source: "client" });
      break;
    }

    case "shape:delete": {
      const shapeId = Number(data.shapeId);
      if (isNaN(shapeId)) {
        user.ws.send(JSON.stringify({ type: "error", message: "Invalid shapeId for shape:delete" }));
        break;
      }

      try {
        await prisma.shape.delete({ where: { id: shapeId } });
      } catch (err) {
        console.warn("shape:delete — shape not found in DB, broadcasting anyway:", shapeId);
      }

      const room = rooms.get(roomId);
      if (room) {
        room.forEach((u) => {
          if (u.ws.readyState === WebSocket.OPEN) {
            u.ws.send(JSON.stringify({
              type: "shape:delete",
              shapeId,
              roomId,
              userId: user.userId,
            }));
          }
        });
      }
      await publishRoomEvent({ type: "shape:delete", shapeId, roomId, userId: user.userId });
      webSocketEvents.inc({ type: "shape:delete", source: "client" });
      break;
    }

    case "canvas:clear": {
      // Delete all shapes in the room from DB
      try {
        await prisma.shape.deleteMany({ where: { roomId: Number(roomId) } });
      } catch (err) {
        console.error("canvas:clear DB delete failed:", err);
      }

      const room = rooms.get(roomId);
      if (room) {
        room.forEach((u) => {
          if (u.ws.readyState === WebSocket.OPEN) {
            u.ws.send(JSON.stringify({
              type: "canvas:clear",
              roomId,
              userId: user.userId,
            }));
          }
        });
      }
      await publishRoomEvent({ type: "canvas:clear", roomId, userId: user.userId });
      webSocketEvents.inc({ type: "canvas:clear", source: "client" });
      break;
    }

    case "cursor:move": {
      // Broadcast cursor position to all OTHER users in the room — no DB write needed
      const room = rooms.get(roomId);
      if (room) {
        room.forEach((u) => {
          if (u.ws !== user.ws && u.ws.readyState === WebSocket.OPEN) {
            u.ws.send(JSON.stringify({
              type: "cursor:move",
              userId: user.userId,
              name: user.name,
              x: data.x,
              y: data.y,
              roomId,
            }));
          }
        });
      }
      // Do NOT publish cursor moves to Redis — they're ephemeral and high-frequency
      break;
    }

    default:
      user.ws.send(
        JSON.stringify({ type: "error", message: "Unknown event type" }),
      );
  }
}

/** Broadcasts a validated event received from another WebSocket pod via Redis. */
export function broadcastRedisEvent(data: Record<string, unknown>) {
  const roomId = String(data.roomId ?? "");
  const room = rooms.get(roomId);
  if (!room) return;

  room.forEach((user) => {
    if (user.ws.readyState === WebSocket.OPEN) {
      user.ws.send(JSON.stringify(data));
    }
  });
  webSocketEvents.inc({ type: String(data.type ?? "unknown"), source: "redis" });
}
