/**
 * Room management API tests
 * POST   /room
 * DELETE /room/:roomId
 * GET    /room/:slug
 * GET    /rooms
 */

import "./__mocks__/db.mock";
import request from "supertest";
import express, { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prismaClient as prisma } from "@repo/db/client";
import { mockPrisma } from "./__mocks__/db.mock";
import { authHeader } from "./__mocks__/jwt.helper";

const JWT_SECRET = "123";

function authMiddleware(req: Request, res: Response, next: NextFunction) {
  let token = req.headers.authorization as string | undefined;
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (req as any).userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ message: "Unauthorized" });
  }
}

function buildApp() {
  const app = express();
  app.use(express.json());

  // POST /room
  app.post("/room", authMiddleware, async (req, res) => {
    const { name } = req.body;
    if (!name || name.length < 3 || name.length > 20) {
      return res.status(400).json({ message: "Incorrect inputs" });
    }
    const userId = (req as any).userId;
    try {
      const room = await (prisma as any).room.create({
        data: { slug: name, adminId: userId },
      });
      res.json({ message: "Room created successfully", data: { roomId: room.id } });
    } catch (e: any) {
      if (e.code === "P2002") {
        return res.status(400).json({ message: "Room with this name already exists." });
      }
      res.status(500).json({ message: "Something went wrong while creating the room." });
    }
  });

  // DELETE /room/:roomId
  app.delete("/room/:roomId", authMiddleware, async (req, res) => {
    const roomId = Number(req.params.roomId);
    const userId = (req as any).userId;
    if (isNaN(roomId)) return res.status(400).json({ message: "Invalid room ID" });
    try {
      await (prisma as any).room.delete({ where: { id: roomId, adminId: userId } });
      res.json({ message: "Room deleted successfully" });
    } catch {
      res.status(500).json({ message: "Something went wrong while deleting the room." });
    }
  });

  // GET /room/:slug
  app.get("/room/:slug", async (req, res) => {
    const room = await (prisma as any).room.findFirst({ where: { slug: req.params.slug } });
    res.json({ room });
  });

  // GET /rooms
  app.get("/rooms", authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const rooms = await (prisma as any).room.findMany({
      where: { deletedAt: null, adminId: userId },
    });
    res.json({ rooms });
  });

  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("POST /room", () => {
  let app: express.Express;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  it("creates a room for an authenticated user", async () => {
    mockPrisma.room.create.mockResolvedValueOnce({ id: 42, slug: "my-room" });

    const res = await request(app)
      .post("/room")
      .set("Authorization", authHeader("user-123"))
      .send({ name: "my-room" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Room created successfully");
    expect(res.body.data.roomId).toBe(42);
    expect(mockPrisma.room.create).toHaveBeenCalledWith({
      data: { slug: "my-room", adminId: "user-123" },
    });
  });

  it("returns 401 when no token is provided", async () => {
    const res = await request(app).post("/room").send({ name: "my-room" });
    expect(res.status).toBe(401);
  });

  it("rejects room name shorter than 3 characters", async () => {
    const res = await request(app)
      .post("/room")
      .set("Authorization", authHeader())
      .send({ name: "ab" });
    expect(res.status).toBe(400);
  });

  it("rejects room name longer than 20 characters", async () => {
    const res = await request(app)
      .post("/room")
      .set("Authorization", authHeader())
      .send({ name: "this-name-is-way-too-long-for-a-room" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when room name already exists (P2002)", async () => {
    const duplicateError: any = new Error("Unique constraint");
    duplicateError.code = "P2002";
    mockPrisma.room.create.mockRejectedValueOnce(duplicateError);

    const res = await request(app)
      .post("/room")
      .set("Authorization", authHeader())
      .send({ name: "taken-room" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Room with this name already exists.");
  });

  it("stores adminId as the authenticated user's ID", async () => {
    mockPrisma.room.create.mockResolvedValueOnce({ id: 1, slug: "secure-room" });

    await request(app)
      .post("/room")
      .set("Authorization", authHeader("owner-456"))
      .send({ name: "secure-room" });

    expect(mockPrisma.room.create).toHaveBeenCalledWith({
      data: { slug: "secure-room", adminId: "owner-456" },
    });
  });
});

describe("DELETE /room/:roomId", () => {
  let app: express.Express;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  it("deletes a room owned by the authenticated user", async () => {
    mockPrisma.room.delete.mockResolvedValueOnce({ id: 10 });

    const res = await request(app)
      .delete("/room/10")
      .set("Authorization", authHeader("user-123"));

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Room deleted successfully");
    // Prisma delete must scope by both id AND adminId — prevents unauthorized deletion
    expect(mockPrisma.room.delete).toHaveBeenCalledWith({
      where: { id: 10, adminId: "user-123" },
    });
  });

  it("returns 400 for non-numeric roomId", async () => {
    const res = await request(app)
      .delete("/room/abc")
      .set("Authorization", authHeader());

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid room ID");
  });

  it("returns 401 without a token", async () => {
    const res = await request(app).delete("/room/10");
    expect(res.status).toBe(401);
  });

  it("returns 500 when user tries to delete a room they don't own", async () => {
    // Prisma throws when adminId doesn't match — simulating P2025 record not found
    mockPrisma.room.delete.mockRejectedValueOnce(new Error("Record not found"));

    const res = await request(app)
      .delete("/room/10")
      .set("Authorization", authHeader("wrong-user"));

    expect(res.status).toBe(500);
  });
});

describe("GET /room/:slug", () => {
  let app: express.Express;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  it("returns room data for a valid slug", async () => {
    mockPrisma.room.findFirst.mockResolvedValueOnce({
      id: 5,
      slug: "design-session",
      adminId: "user-1",
    });

    const res = await request(app).get("/room/design-session");

    expect(res.status).toBe(200);
    expect(res.body.room.slug).toBe("design-session");
    expect(res.body.room.id).toBe(5);
  });

  it("returns { room: null } for a non-existent slug", async () => {
    mockPrisma.room.findFirst.mockResolvedValueOnce(null);

    const res = await request(app).get("/room/does-not-exist");

    expect(res.status).toBe(200);
    expect(res.body.room).toBeNull();
  });

  it("is a public endpoint — no auth required", async () => {
    mockPrisma.room.findFirst.mockResolvedValueOnce({ id: 1, slug: "open-room" });

    // No Authorization header — should still work
    const res = await request(app).get("/room/open-room");
    expect(res.status).toBe(200);
  });
});

describe("GET /rooms", () => {
  let app: express.Express;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  it("returns all rooms belonging to the authenticated user", async () => {
    mockPrisma.room.findMany.mockResolvedValueOnce([
      { id: 1, slug: "room-a", adminId: "user-123" },
      { id: 2, slug: "room-b", adminId: "user-123" },
    ]);

    const res = await request(app)
      .get("/rooms")
      .set("Authorization", authHeader("user-123"));

    expect(res.status).toBe(200);
    expect(res.body.rooms).toHaveLength(2);
    expect(mockPrisma.room.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ adminId: "user-123" }),
      })
    );
  });

  it("returns empty array when user has no rooms", async () => {
    mockPrisma.room.findMany.mockResolvedValueOnce([]);

    const res = await request(app)
      .get("/rooms")
      .set("Authorization", authHeader("user-999"));

    expect(res.status).toBe(200);
    expect(res.body.rooms).toEqual([]);
  });

  it("returns 401 without a token", async () => {
    const res = await request(app).get("/rooms");
    expect(res.status).toBe(401);
  });

  it("only returns non-deleted rooms (deletedAt: null filter)", async () => {
    mockPrisma.room.findMany.mockResolvedValueOnce([]);

    await request(app)
      .get("/rooms")
      .set("Authorization", authHeader("user-123"));

    expect(mockPrisma.room.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      })
    );
  });
});
