/**
 * Shapes API tests
 * GET /shapes/:roomId
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

  app.get("/shapes/:roomId", authMiddleware, async (req, res) => {
    try {
      const roomId = Number(req.params.roomId);
      const shapes = await (prisma as any).shape.findMany({
        where: { roomId },
        orderBy: { id: "asc" },
        take: 1000,
      });
      res.json(shapes);
    } catch {
      res.status(400).json({ shapes: [], message: "Something went wrong" });
    }
  });

  return app;
}

// ─── Sample shape fixtures ─────────────────────────────────────────────────
const rectangleShape = {
  id: 1,
  roomId: 5,
  type: "RECTANGLE",
  startX: 100,
  startY: 100,
  width: 200,
  height: 150,
  strokeColor: "#000000",
  fillColor: "transparent",
};

const circleShape = {
  id: 2,
  roomId: 5,
  type: "ELLIPSE",
  startX: 300,
  startY: 300,
  width: 100,
  height: 100,
  strokeColor: "#ff0000",
  fillColor: "#ffeeee",
};

const lineShape = {
  id: 3,
  roomId: 5,
  type: "LINE",
  points: [[0, 0], [100, 100]],
  strokeColor: "#0000ff",
};

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("GET /shapes/:roomId", () => {
  let app: express.Express;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  it("returns all shapes for a valid roomId", async () => {
    mockPrisma.shape.findMany.mockResolvedValueOnce([
      rectangleShape,
      circleShape,
      lineShape,
    ]);

    const res = await request(app)
      .get("/shapes/5")
      .set("Authorization", authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0].type).toBe("RECTANGLE");
    expect(res.body[1].type).toBe("ELLIPSE");
    expect(res.body[2].type).toBe("LINE");
  });

  it("returns empty array when room has no shapes", async () => {
    mockPrisma.shape.findMany.mockResolvedValueOnce([]);

    const res = await request(app)
      .get("/shapes/99")
      .set("Authorization", authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("queries shapes filtered by the correct roomId", async () => {
    mockPrisma.shape.findMany.mockResolvedValueOnce([rectangleShape]);

    await request(app)
      .get("/shapes/5")
      .set("Authorization", authHeader());

    expect(mockPrisma.shape.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { roomId: 5 },
      })
    );
  });

  it("limits results to 1000 shapes (DoS protection)", async () => {
    mockPrisma.shape.findMany.mockResolvedValueOnce([]);

    await request(app)
      .get("/shapes/5")
      .set("Authorization", authHeader());

    expect(mockPrisma.shape.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1000 })
    );
  });

  it("returns shapes ordered by id ascending (correct canvas draw order)", async () => {
    mockPrisma.shape.findMany.mockResolvedValueOnce([]);

    await request(app)
      .get("/shapes/5")
      .set("Authorization", authHeader());

    expect(mockPrisma.shape.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { id: "asc" } })
    );
  });

  it("returns 401 without authentication", async () => {
    const res = await request(app).get("/shapes/5");
    expect(res.status).toBe(401);
  });

  it("returns 400 when DB query fails", async () => {
    mockPrisma.shape.findMany.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .get("/shapes/5")
      .set("Authorization", authHeader());

    expect(res.status).toBe(400);
  });

  it("handles all shape types correctly", async () => {
    const allShapeTypes = [
      { id: 1, type: "RECTANGLE", roomId: 1 },
      { id: 2, type: "ELLIPSE", roomId: 1 },
      { id: 3, type: "LINE", roomId: 1 },
      { id: 4, type: "DIAMOND", roomId: 1 },
      { id: 5, type: "ARROW", roomId: 1 },
      { id: 6, type: "TEXT", roomId: 1 },
      { id: 7, type: "PENCIL", roomId: 1 },
    ];

    mockPrisma.shape.findMany.mockResolvedValueOnce(allShapeTypes);

    const res = await request(app)
      .get("/shapes/1")
      .set("Authorization", authHeader());

    expect(res.status).toBe(200);
    const types = res.body.map((s: any) => s.type);
    expect(types).toContain("RECTANGLE");
    expect(types).toContain("ELLIPSE");
    expect(types).toContain("ARROW");
    expect(types).toContain("TEXT");
  });
});
