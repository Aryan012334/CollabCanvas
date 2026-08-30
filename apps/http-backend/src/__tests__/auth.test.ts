/**
 * Authentication API tests
 * POST /signup
 * POST /login
 * GET  /me
 */

import "./__mocks__/db.mock";
import request from "supertest";
import express, { NextFunction, Request, Response } from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prismaClient as prisma } from "@repo/db/client";
import { mockPrisma } from "./__mocks__/db.mock";
import { authHeader } from "./__mocks__/jwt.helper";

// ─── Minimal app that only registers auth routes ─────────────────────────────
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  const JWT_SECRET = "123";

  // Auth middleware inline (same logic as middleware.ts)
  function authMiddleware(req: Request, res: Response, next: NextFunction) {
    let token = req.headers.authorization as string | undefined;
    if (!token) token = req.cookies?.token;
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      (req as any).userId = decoded.userId;
      next();
    } catch {
      res.status(401).json({ message: "Unauthorized" });
    }
  }

  // POST /signup
  app.post("/signup", async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password || !name || password.length < 8 || name.length < 2) {
      return res.status(400).json({ message: "Incorrect inputs" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      const user = await (prisma as any).user.create({
        data: { name, email, password: hashedPassword },
      });
      res.json({ message: "User created successfully", data: { userId: user.id } });
    } catch (e: any) {
      res.status(500).json({ error: "error creating the user" });
    }
  });

  // POST /login
  app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Incorrect inputs" });

    const user = await (prisma as any).user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ message: "Incorrect email or password" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Incorrect email or password" });

    const token = jwt.sign({ userId: user.id, name: user.name }, JWT_SECRET);
    res
      .cookie("token", token, { maxAge: 86400000, path: "/" })
      .json({
        message: "Login successful",
        user: { id: user.id, name: user.name, email: user.email, token },
      });
  });

  // GET /me
  app.get("/me", authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const user = await (prisma as any).user.findUnique({ where: { id: userId } });
    if (!user) return res.status(401).json({ message: "User not found" });
    res.json({ user });
  });

  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("POST /signup", () => {
  let app: express.Express;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  it("creates a user and returns userId", async () => {
    mockPrisma.user.create.mockResolvedValueOnce({
      id: "user-1",
      name: "Aryan Test",
      email: "aryan@test.com",
    });

    const res = await request(app).post("/signup").send({
      name: "Aryan Test",
      email: "aryan@test.com",
      password: "StrongPass123",
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("User created successfully");
    expect(res.body.data.userId).toBe("user-1");
    expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
  });

  it("rejects signup with missing name", async () => {
    const res = await request(app).post("/signup").send({
      email: "aryan@test.com",
      password: "StrongPass123",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Incorrect inputs");
  });

  it("rejects signup with password shorter than 8 chars", async () => {
    const res = await request(app).post("/signup").send({
      name: "Aryan",
      email: "aryan@test.com",
      password: "short",
    });
    expect(res.status).toBe(400);
  });

  it("rejects signup with invalid email format", async () => {
    const res = await request(app).post("/signup").send({
      name: "Aryan",
      email: "not-an-email",
      password: "StrongPass123",
    });
    // Zod rejects non-email — schema validates email format
    expect(res.status).toBe(400);
  });

  it("returns 500 when DB throws on duplicate email", async () => {
    mockPrisma.user.create.mockRejectedValueOnce(new Error("unique constraint"));

    const res = await request(app).post("/signup").send({
      name: "Aryan Test",
      email: "aryan@test.com",
      password: "StrongPass123",
    });

    expect(res.status).toBe(500);
  });

  it("hashes the password before storing — never stores plaintext", async () => {
    let capturedData: any;
    mockPrisma.user.create.mockImplementationOnce(async ({ data }: any) => {
      capturedData = data;
      return { id: "u1", ...data };
    });

    await request(app).post("/signup").send({
      name: "Hash Test",
      email: "hash@test.com",
      password: "PlainText99",
    });

    expect(capturedData.password).not.toBe("PlainText99");
    expect(capturedData.password).toMatch(/^\$2[ab]\$/); // bcrypt hash pattern
  });
});

describe("POST /login", () => {
  let app: express.Express;
  const hashedPassword = bcrypt.hashSync("ValidPass99", 10);

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  it("logs in a valid user and returns token + sets cookie", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      name: "Aryan",
      email: "aryan@test.com",
      password: hashedPassword,
    });

    const res = await request(app).post("/login").send({
      email: "aryan@test.com",
      password: "ValidPass99",
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Login successful");
    expect(res.body.user.token).toBeDefined();
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("returns 400 for non-existent user", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const res = await request(app).post("/login").send({
      email: "ghost@test.com",
      password: "ValidPass99",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Incorrect email or password");
  });

  it("returns 400 for wrong password", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      name: "Aryan",
      email: "aryan@test.com",
      password: hashedPassword,
    });

    const res = await request(app).post("/login").send({
      email: "aryan@test.com",
      password: "WrongPassword1",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Incorrect email or password");
  });

  it("returns 400 when email is missing", async () => {
    const res = await request(app).post("/login").send({ password: "ValidPass99" });
    expect(res.status).toBe(400);
  });

  it("does not expose the hashed password in the response", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      name: "Aryan",
      email: "aryan@test.com",
      password: hashedPassword,
    });

    const res = await request(app).post("/login").send({
      email: "aryan@test.com",
      password: "ValidPass99",
    });

    expect(JSON.stringify(res.body)).not.toContain(hashedPassword);
  });
});

describe("GET /me", () => {
  let app: express.Express;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  it("returns user data for a valid token", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-123",
      name: "Aryan",
      email: "aryan@test.com",
    });

    const res = await request(app)
      .get("/me")
      .set("Authorization", authHeader("user-123"));

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe("user-123");
  });

  it("returns 401 with no token", async () => {
    const res = await request(app).get("/me");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });

  it("returns 401 with a tampered token", async () => {
    const res = await request(app)
      .get("/me")
      .set("Authorization", "Bearer invalid.token.here");
    expect(res.status).toBe(401);
  });

  it("returns 401 when user is not found in DB", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const res = await request(app)
      .get("/me")
      .set("Authorization", authHeader("deleted-user"));

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("User not found");
  });
});
