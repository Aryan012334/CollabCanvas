import { User, rooms } from "../state";
import { prismaClient as prisma } from "@repo/db/client";
import WebSocket from "ws";
import { ShapeType } from "@repo/db/client";
import { Job } from "../utils/auth";

const queue: {
  job: Job;
  resolve: (v: any) => void;
  reject: (e: any) => void;
}[] = [];
let processing = false;

// --- Enqueue with Promise ---
export function enqueue(job: Job): Promise<any> {
  return new Promise((resolve, reject) => {
    queue.push({ job, resolve, reject });
    processQueue();
  });
}

// --- Process Queue ---
async function processQueue() {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const { job, resolve, reject } = queue.shift()!;
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
      console.error("DB write failed, retrying:", err);
      queue.push({ job, resolve, reject }); // requeue
      await new Promise((r) => setTimeout(r, 1000)); // backoff
    }
  }

  processing = false;
}

export async function handleEvent(user: User, data: any) {
  switch (data.type) {
    case "join-room": {
      //add a new room with this id
      //check if the room is not in the rooms map
      if (!rooms.has(data.roomId)) {
        rooms.set(data.roomId, new Set());
      }
      const room = rooms.get(data.roomId);

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
      const room = rooms.get(data.roomId);
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
                roomId: data.roomId,
              }),
            );
          }
        });

        if (room.size === 0) {
          rooms.delete(data.roomId);
        }

        console.log(`User ${user.name} left room ${data.roomId} gracefully`);
      }
      break;
    }

    case "chat": {
      // broadcast immediately
      const room = rooms.get(data.roomId);
      if (room) {
        room.forEach((u) =>
          u.ws.send(
            JSON.stringify({
              type: "chat",
              message: data.message,
              roomId: data.roomId,
              userId: user.userId,
              username: user.name,
            }),
          ),
        );
      }

      // enqueue DB write
      enqueue({
        type: "chat",
        roomId: data.roomId,
        userId: user.userId,
        payload: { message: data.message },
      });
      break;
    }

    case "shape:create": {
      const room = rooms.get(data.roomId);
      const createdShape = await enqueue({
        type: "shape:create",
        roomId: data.roomId,
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
                roomId: data.roomId,
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
      const room = rooms.get(data.roomId);

      const updatedShape = await enqueue({
        type: "shape:update",
        roomId: data.roomId,
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
              roomId: data.roomId,
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
