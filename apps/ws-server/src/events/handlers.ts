import { User, rooms } from "../state";
import { prismaClient as prisma } from "@repo/db/client";
import WebSocket from "ws";
import { ShapeType } from "@repo/db/client";
import { Job } from "../utils/auth";

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
      break;
    }

    case "shape:create": {
      const room = rooms.get(roomId);
      const createdShape = await enqueue({
        type: "shape:create",
        roomId: roomId,
        userId: user.userId,
        payload: data.shape,
      });
      if (room) {
        room.forEach((u) => {
          if (u.ws.readyState === WebSocket.OPEN) {
            u.ws.send(
              JSON.stringify({
                type: "shape:create",
                shape: {
                  ...data.shape,
                  id: createdShape.id,
                },
                roomId: roomId,
                userId: user.userId,
                username: user.name,
              }),
            );
          }
        });
      }
      break;
    }

    case "shape:update": {
      const room = rooms.get(roomId);

      const updatedShape = await enqueue({
        type: "shape:update",
        roomId: roomId,
        userId: user.userId,
        payload: data.shape,
      });
      if (room) {
        room.forEach((u) =>
          u.ws.send(
            JSON.stringify({
              type: "shape:update",
              shape: {
                ...data.shape,
                id: updatedShape.id,
              },
              roomId: roomId,
              userId: user.userId,
              username: user.name,
            }),
          ),
        );
      }
      break;
    }

    default:
      user.ws.send(
        JSON.stringify({ type: "error", message: "Unknown event type" }),
      );
  }
}
