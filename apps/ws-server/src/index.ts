import http from "http";
import express from "express";
import { WebSocketServer } from "ws";
import cron from "node-cron";
import dotenv from "dotenv";

import { verifyToken } from "./utils/auth";
import { addUser, removeUser } from "./state";
import { handleEvent } from "./events/handlers";

import { prismaClient as prisma } from "@repo/db/client";

// Load env
dotenv.config({ path: "../../.env" });

const app = express();

// Health endpoint
app.get("/health", async (_, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: "ok",
      ws: "alive",
      time: new Date().toISOString(),
    });
  } catch (err) {
    console.error("WS health failed:", err);

    res.status(500).json({
      status: "error",
    });
  }
});

// HTTP server
const server = http.createServer(app);

// WS server
const wss = new WebSocketServer({ server });

// WS logic (unchanged)
wss.on("connection", (ws, req) => {
  const url = req.url;

  if (!url) return ws.close(4001, "Missing URL");

  const params = new URLSearchParams(url.split("?")[1]);
  const token = params.get("token") || "";

  const payload = verifyToken(token);

  if (!payload) return ws.close(4002, "Unauthorized");

  const user = {
    userId: payload.userId,
    name: payload.name ?? "John",
    ws,
  };

  addUser(user);

  ws.on("message", (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      handleEvent(user, data);
    } catch {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Invalid message format",
        }),
      );
    }
  });

  ws.on("close", () => removeUser(user.userId));

  ws.on("error", (error) => {
    console.error(`WebSocket error for user ${user.name}:`, error);
  });
});

// Port (Render safe)
const PORT = Number(process.env.PORT) || 4000;

// Start server
server.listen(PORT, () => {
  console.log(`🚀 WS server running on port ${PORT}`);

  startCron();
});

// Internal cron
function startCron() {
  cron.schedule("*/14 * * * *", async () => {
    try {
      console.log("⏰ WS cron running");

      await prisma.$queryRaw`SELECT 1`;

      console.log("✅ WS DB alive");
    } catch (err) {
      console.error("❌ WS cron failed:", err);
    }
  });
}
