/**
 * Health endpoint tests
 * GET /health
 */

import "../__tests__/__mocks__/db.mock"; // must be first — patches prisma before app loads
import request from "supertest";
import express from "express";
import { prismaClient as prisma } from "@repo/db/client";
import { mockPrisma } from "./__mocks__/db.mock";

// Inline minimal app to avoid side effects (cron, port binding) from index.ts
function buildApp() {
  const app = express();
  app.use(express.json());
  app.get("/health", async (_, res) => {
    await (prisma as any).$queryRaw`SELECT 1`;
    res.json({ ok: true });
  });
  return app;
}

describe("GET /health", () => {
  let app: express.Express;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  it("returns 200 and { ok: true } when DB is reachable", async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);

    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("propagates error when DB is unreachable", async () => {
    mockPrisma.$queryRaw.mockRejectedValueOnce(new Error("DB connection failed"));

    await expect(request(app).get("/health")).rejects.toThrow();
  });
});
