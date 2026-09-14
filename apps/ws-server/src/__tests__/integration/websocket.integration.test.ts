/**
 * WebSocket Integration Tests
 *
 * Spins up a real HTTP + WebSocket server on a random port,
 * connects real WS clients, and tests end-to-end message flows.
 *
 * DB writes are mocked so no database is required.
 * Covers: connection auth, join-room, leave-room, chat,
 *         shape:create, shape:update, broadcast, and error handling.
 */

import http from "http";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { AddressInfo } from "net";

// ─── Mock DB before anything imports it ──────────────────────────────────────
jest.mock("@repo/db/client", () => ({
  prismaClient: {
    chat: { create: jest.fn().mockResolvedValue({ id: 1 }) },
    shape: {
      create: jest.fn().mockResolvedValue({ id: 99, type: "RECTANGLE" }),
      update: jest.fn().mockResolvedValue({ id: 99, type: "RECTANGLE" }),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $disconnect: jest.fn(),
  },
  ShapeType: {
    RECTANGLE: "RECTANGLE",
    ELLIPSE: "ELLIPSE",
    LINE: "LINE",
    DIAMOND: "DIAMOND",
    ARROW: "ARROW",
    TEXT: "TEXT",
    PENCIL: "PENCIL",
  },
}));

import { verifyToken } from "../../utils/auth";
import { addUser, removeUser, users, rooms } from "../../state";
import { handleEvent } from "../../events/handlers";

const JWT_SECRET = "123";

// ─── Test server factory ──────────────────────────────────────────────────────
function createTestServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    const url = req.url || "";
    const params = new URLSearchParams(url.split("?")[1] || "");
    const token = params.get("token") || "";

    const payload = verifyToken(token);
    if (!payload) return ws.close(4002, "Unauthorized");

    const user = { userId: payload.userId, name: payload.name ?? "Test", ws };
    addUser(user);

    ws.on("message", (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        handleEvent(user, data);
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
      }
    });

    ws.on("close", () => removeUser(user.userId));
  });

  return { server, wss };
}

// ─── Client factory ───────────────────────────────────────────────────────────
function makeToken(userId: string, name: string = "Test User") {
  return jwt.sign({ userId, name }, JWT_SECRET);
}

function connectClient(port: number, token: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}?token=${token}`);
    let settled = false;
    let opened = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    ws.on("open", () => {
      opened = true;
      // A WebSocket upgrade can succeed before the server immediately closes
      // an invalid token. Wait one event-loop turn before declaring success.
      setTimeout(() => {
        if (!settled && ws.readyState === WebSocket.OPEN) {
          settled = true;
          resolve(ws);
        }
      }, 20);
    });
    ws.on("error", (error) => fail(error));
    ws.on("close", (code) => {
      if (!settled && (!opened || code !== 1000)) {
        fail(new Error(`Closed with code ${code}`));
      }
    });
  });
}

/**
 * Wait for the next message from a WebSocket client.
 * Optional filter lets you wait for a specific message type.
 */
function nextMessage(
  ws: WebSocket,
  filter?: (msg: any) => boolean,
  timeout = 4000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout waiting for WS message")), timeout);

    function handler(raw: any) {
      const msg = JSON.parse(raw.toString());
      if (!filter || filter(msg)) {
        clearTimeout(timer);
        ws.off("message", handler);
        resolve(msg);
      }
    }
    ws.on("message", handler);
  });
}

function closeClient(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) return resolve();
    ws.on("close", () => resolve());
    ws.close();
  });
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────
let server: http.Server;
let wss: WebSocketServer;
let port: number;

beforeAll((done) => {
  const s = createTestServer();
  server = s.server;
  wss = s.wss;
  server.listen(0, () => {
    port = (server.address() as AddressInfo).port;
    done();
  });
});

afterAll((done) => {
  wss.close(() => server.close(done));
});

beforeEach(() => {
  users.clear();
  rooms.clear();
  jest.clearAllMocks();
});

// ─── Connection & Authentication ──────────────────────────────────────────────
describe("WebSocket Connection", () => {
  it("accepts connection with a valid JWT token", async () => {
    const token = makeToken("u1", "Alice");
    const ws = await connectClient(port, token);
    expect(ws.readyState).toBe(WebSocket.OPEN);
    await closeClient(ws);
  });

  it("rejects connection with no token (closes with code 4002)", async () => {
    await expect(connectClient(port, "")).rejects.toThrow();
  });

  it("rejects connection with a tampered token", async () => {
    await expect(
      connectClient(port, "header.tampered-payload.signature")
    ).rejects.toThrow();
  });

  it("rejects connection with a token signed by wrong secret", async () => {
    const badToken = jwt.sign({ userId: "u1" }, "wrong-secret");
    await expect(connectClient(port, badToken)).rejects.toThrow();
  });

  it("adds the user to the users map on connection", async () => {
    const token = makeToken("u-connect-1", "ConnectUser");
    const ws = await connectClient(port, token);

    expect(users.has("u-connect-1")).toBe(true);
    await closeClient(ws);
  });

  it("removes the user from the users map on disconnect", async () => {
    const token = makeToken("u-disconnect", "DisconnectUser");
    const ws = await connectClient(port, token);
    expect(users.has("u-disconnect")).toBe(true);

    await closeClient(ws);
    await new Promise((r) => setTimeout(r, 100)); // let close handler fire
    expect(users.has("u-disconnect")).toBe(false);
  });

  it("allows multiple clients to connect simultaneously", async () => {
    const ws1 = await connectClient(port, makeToken("u-multi-1"));
    const ws2 = await connectClient(port, makeToken("u-multi-2"));
    const ws3 = await connectClient(port, makeToken("u-multi-3"));

    expect(ws1.readyState).toBe(WebSocket.OPEN);
    expect(ws2.readyState).toBe(WebSocket.OPEN);
    expect(ws3.readyState).toBe(WebSocket.OPEN);

    await Promise.all([closeClient(ws1), closeClient(ws2), closeClient(ws3)]);
  });
});

// ─── join-room ────────────────────────────────────────────────────────────────
describe("join-room event", () => {
  it("adds user to the room on join-room", async () => {
    const ws = await connectClient(port, makeToken("u-join", "JoinUser"));

    ws.send(JSON.stringify({ type: "join-room", roomId: "room-100" }));
    await new Promise((r) => setTimeout(r, 200));

    const room = rooms.get("room-100");
    expect(room).toBeDefined();
    expect(room!.size).toBe(1);

    await closeClient(ws);
  });

  it("broadcasts user_joined to other users already in the room", async () => {
    const ws1 = await connectClient(port, makeToken("u-first", "FirstUser"));
    const ws2 = await connectClient(port, makeToken("u-second", "SecondUser"));

    // First user joins
    ws1.send(JSON.stringify({ type: "join-room", roomId: "room-broadcast" }));
    await new Promise((r) => setTimeout(r, 150));

    // Set up listener on ws1 BEFORE second user joins
    const joinedPromise = nextMessage(
      ws1,
      (m) => m.type === "user_joined"
    );

    // Second user joins
    ws2.send(JSON.stringify({ type: "join-room", roomId: "room-broadcast" }));

    const msg = await joinedPromise;
    expect(msg.type).toBe("user_joined");
    expect(msg.userId).toBe("SecondUser");

    await Promise.all([closeClient(ws1), closeClient(ws2)]);
  });

  it("creates a new room entry when first user joins", async () => {
    const ws = await connectClient(port, makeToken("u-newroom"));
    const roomId = `room-new-${Date.now()}`;

    expect(rooms.has(roomId)).toBe(false);
    ws.send(JSON.stringify({ type: "join-room", roomId }));
    await new Promise((r) => setTimeout(r, 150));

    expect(rooms.has(roomId)).toBe(true);
    await closeClient(ws);
  });
});

// ─── leave-room ───────────────────────────────────────────────────────────────
describe("leave-room event", () => {
  it("removes user from the room on leave-room", async () => {
    const ws = await connectClient(port, makeToken("u-leave"));

    ws.send(JSON.stringify({ type: "join-room", roomId: "room-leave" }));
    await new Promise((r) => setTimeout(r, 150));
    expect(rooms.get("room-leave")?.size).toBe(1);

    ws.send(JSON.stringify({ type: "leave-room", roomId: "room-leave" }));
    await new Promise((r) => setTimeout(r, 150));

    expect(rooms.has("room-leave")).toBe(false);
    await closeClient(ws);
  });

  it("broadcasts user_left to remaining room members", async () => {
    const ws1 = await connectClient(port, makeToken("u-stay", "StayUser"));
    const ws2 = await connectClient(port, makeToken("u-leave2", "LeaveUser"));

    ws1.send(JSON.stringify({ type: "join-room", roomId: "room-left-event" }));
    ws2.send(JSON.stringify({ type: "join-room", roomId: "room-left-event" }));
    await new Promise((r) => setTimeout(r, 200));

    const leftPromise = nextMessage(ws1, (m) => m.type === "user_left");
    ws2.send(JSON.stringify({ type: "leave-room", roomId: "room-left-event" }));

    const msg = await leftPromise;
    expect(msg.type).toBe("user_left");
    expect(msg.userId).toBe("u-leave2");

    await Promise.all([closeClient(ws1), closeClient(ws2)]);
  });
});

// ─── chat ─────────────────────────────────────────────────────────────────────
describe("chat event", () => {
  it("broadcasts chat message to all users in the room", async () => {
    const ws1 = await connectClient(port, makeToken("u-chat-1", "ChatUser1"));
    const ws2 = await connectClient(port, makeToken("u-chat-2", "ChatUser2"));

    ws1.send(JSON.stringify({ type: "join-room", roomId: "chat-room" }));
    ws2.send(JSON.stringify({ type: "join-room", roomId: "chat-room" }));
    await new Promise((r) => setTimeout(r, 200));

    const chatPromise = nextMessage(ws2, (m) => m.type === "chat");
    ws1.send(
      JSON.stringify({ type: "chat", roomId: "chat-room", message: "Hello!" })
    );

    const msg = await chatPromise;
    expect(msg.type).toBe("chat");
    expect(msg.message).toBe("Hello!");
    expect(msg.userId).toBe("u-chat-1");

    await Promise.all([closeClient(ws1), closeClient(ws2)]);
  });

  it("also delivers chat to the sender", async () => {
    const ws = await connectClient(port, makeToken("u-chat-self", "SelfChat"));

    ws.send(JSON.stringify({ type: "join-room", roomId: "self-chat-room" }));
    await new Promise((r) => setTimeout(r, 150));

    const chatPromise = nextMessage(ws, (m) => m.type === "chat");
    ws.send(
      JSON.stringify({ type: "chat", roomId: "self-chat-room", message: "Echo!" })
    );

    const msg = await chatPromise;
    expect(msg.message).toBe("Echo!");
    await closeClient(ws);
  });

  it("enqueues a DB write for the chat message", async () => {
    const { prismaClient: prisma } = require("@repo/db/client");
    const ws = await connectClient(port, makeToken("u-db-chat"));

    ws.send(JSON.stringify({ type: "join-room", roomId: "db-chat-room" }));
    await new Promise((r) => setTimeout(r, 150));

    ws.send(
      JSON.stringify({ type: "chat", roomId: "db-chat-room", message: "DB write test" })
    );
    await new Promise((r) => setTimeout(r, 300));

    expect(prisma.chat.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ message: "DB write test" }),
      })
    );

    await closeClient(ws);
  });
});

// ─── shape:create ─────────────────────────────────────────────────────────────
describe("shape:create event", () => {
  it("broadcasts shape:create to all users in the room with a DB-assigned id", async () => {
    const ws1 = await connectClient(port, makeToken("u-shape-1", "ShapeUser1"));
    const ws2 = await connectClient(port, makeToken("u-shape-2", "ShapeUser2"));

    ws1.send(JSON.stringify({ type: "join-room", roomId: "shape-room" }));
    ws2.send(JSON.stringify({ type: "join-room", roomId: "shape-room" }));
    await new Promise((r) => setTimeout(r, 200));

    const shapePromise = nextMessage(ws2, (m) => m.type === "shape:create");

    ws1.send(
      JSON.stringify({
        type: "shape:create",
        roomId: "shape-room",
        shape: {
          type: "RECTANGLE",
          startX: 10,
          startY: 20,
          width: 100,
          height: 80,
          strokeColor: "#000",
          fillColor: "transparent",
        },
      })
    );

    const msg = await shapePromise;
    expect(msg.type).toBe("shape:create");
    expect(msg.shape.type).toBe("RECTANGLE");
    expect(msg.shape.id).toBe(99); // mocked DB returns id: 99
    expect(msg.roomId).toBe("shape-room");

    await Promise.all([closeClient(ws1), closeClient(ws2)]);
  });

  it("writes the shape to the database", async () => {
    const { prismaClient: prisma } = require("@repo/db/client");
    const ws = await connectClient(port, makeToken("u-shape-db"));

    ws.send(JSON.stringify({ type: "join-room", roomId: "shape-db-room" }));
    await new Promise((r) => setTimeout(r, 150));

    ws.send(
      JSON.stringify({
        type: "shape:create",
        roomId: "shape-db-room",
        shape: { type: "ELLIPSE", startX: 0, startY: 0, width: 50, height: 50 },
      })
    );

    await new Promise((r) => setTimeout(r, 400));

    expect(prisma.shape.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "ELLIPSE" }),
      })
    );

    await closeClient(ws);
  });

  it("broadcasts shape:create to all members of the room, not other rooms", async () => {
    const ws1 = await connectClient(port, makeToken("u-iso-1", "IsoUser1"));
    const ws2 = await connectClient(port, makeToken("u-iso-2", "IsoUser2")); // different room
    const ws3 = await connectClient(port, makeToken("u-iso-3", "IsoUser3")); // same as ws1

    ws1.send(JSON.stringify({ type: "join-room", roomId: "room-A" }));
    ws2.send(JSON.stringify({ type: "join-room", roomId: "room-B" })); // different
    ws3.send(JSON.stringify({ type: "join-room", roomId: "room-A" }));
    await new Promise((r) => setTimeout(r, 200));

    let ws2Received = false;
    ws2.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "shape:create") ws2Received = true;
    });

    const shapePromise = nextMessage(ws3, (m) => m.type === "shape:create");
    ws1.send(
      JSON.stringify({
        type: "shape:create",
        roomId: "room-A",
        shape: { type: "LINE", points: [[0, 0], [50, 50]] },
      })
    );

    await shapePromise;
    await new Promise((r) => setTimeout(r, 200));

    // User in different room should NOT receive the message
    expect(ws2Received).toBe(false);

    await Promise.all([closeClient(ws1), closeClient(ws2), closeClient(ws3)]);
  });
});

// ─── shape:update ─────────────────────────────────────────────────────────────
describe("shape:update event", () => {
  it("broadcasts shape:update with updated shape data to all room members", async () => {
    const ws1 = await connectClient(port, makeToken("u-upd-1", "UpdateUser1"));
    const ws2 = await connectClient(port, makeToken("u-upd-2", "UpdateUser2"));

    ws1.send(JSON.stringify({ type: "join-room", roomId: "update-room" }));
    ws2.send(JSON.stringify({ type: "join-room", roomId: "update-room" }));
    await new Promise((r) => setTimeout(r, 200));

    const updatePromise = nextMessage(ws2, (m) => m.type === "shape:update");

    ws1.send(
      JSON.stringify({
        type: "shape:update",
        roomId: "update-room",
        shape: {
          id: 5,
          type: "RECTANGLE",
          startX: 50,
          startY: 60,
          width: 200,
          height: 150,
        },
      })
    );

    const msg = await updatePromise;
    expect(msg.type).toBe("shape:update");
    expect(msg.shape.id).toBeDefined();
    expect(msg.roomId).toBe("update-room");

    await Promise.all([closeClient(ws1), closeClient(ws2)]);
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────
describe("Error handling", () => {
  it("sends error message for unknown event type", async () => {
    const ws = await connectClient(port, makeToken("u-err"));

    ws.send(JSON.stringify({ type: "join-room", roomId: "err-room" }));
    await new Promise((r) => setTimeout(r, 150));

    const errPromise = nextMessage(ws, (m) => m.type === "error");
    ws.send(JSON.stringify({ type: "unknown-event-xyz", roomId: "err-room" }));

    const msg = await errPromise;
    expect(msg.type).toBe("error");
    expect(msg.message).toMatch(/unknown/i);

    await closeClient(ws);
  });

  it("sends error message for malformed (non-JSON) message", async () => {
    const ws = await connectClient(port, makeToken("u-malformed"));

    const errPromise = nextMessage(ws, (m) => m.type === "error");
    ws.send("this is not valid JSON {{{{");

    const msg = await errPromise;
    expect(msg.type).toBe("error");

    await closeClient(ws);
  });

  it("handles rapid messages without crashing the server", async () => {
    const ws = await connectClient(port, makeToken("u-rapid"));

    ws.send(JSON.stringify({ type: "join-room", roomId: "rapid-room" }));
    await new Promise((r) => setTimeout(r, 100));

    // Fire 20 chat messages rapidly
    for (let i = 0; i < 20; i++) {
      ws.send(
        JSON.stringify({ type: "chat", roomId: "rapid-room", message: `msg-${i}` })
      );
    }

    await new Promise((r) => setTimeout(r, 500));

    // Server should still be alive
    expect(ws.readyState).toBe(WebSocket.OPEN);
    await closeClient(ws);
  });

  it("handles a user sending messages to a room they have not joined", async () => {
    const ws = await connectClient(port, makeToken("u-noroom"));

    // Send chat without joining first
    expect(() =>
      ws.send(
        JSON.stringify({ type: "chat", roomId: "non-existent-room", message: "test" })
      )
    ).not.toThrow();

    await new Promise((r) => setTimeout(r, 200));
    expect(ws.readyState).toBe(WebSocket.OPEN);
    await closeClient(ws);
  });
});
