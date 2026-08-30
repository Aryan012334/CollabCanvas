/**
 * Unit tests for authMiddleware
 * Tests the JWT verification logic in isolation — no HTTP server needed.
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { authMiddleware, RequestWithUserId } from "../middleware";

const JWT_SECRET = "123";

// ─── Test helpers ─────────────────────────────────────────────────────────────
function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    cookies: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes(): { res: Response; json: jest.Mock; status: jest.Mock } {
  const json = jest.fn().mockReturnThis();
  const status = jest.fn().mockReturnValue({ json });
  const res = { json, status } as unknown as Response;
  return { res, json, status };
}

function makeNext(): NextFunction {
  return jest.fn();
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("authMiddleware", () => {
  it("calls next() and sets userId when Authorization header has valid token", () => {
    const token = jwt.sign({ userId: "user-abc", name: "Aryan" }, JWT_SECRET);
    const req = makeReq({ headers: { authorization: token } });
    const { res } = makeRes();
    const next = makeNext();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as RequestWithUserId).userId).toBe("user-abc");
  });

  it("calls next() and sets userId when token comes from cookie", () => {
    const token = jwt.sign({ userId: "user-cookie", name: "Test" }, JWT_SECRET);
    const req = makeReq({ headers: {}, cookies: { token } });
    const { res } = makeRes();
    const next = makeNext();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as RequestWithUserId).userId).toBe("user-cookie");
  });

  it("prefers Authorization header over cookie when both are present", () => {
    const headerToken = jwt.sign({ userId: "header-user" }, JWT_SECRET);
    const cookieToken = jwt.sign({ userId: "cookie-user" }, JWT_SECRET);

    const req = makeReq({
      headers: { authorization: headerToken },
      cookies: { token: cookieToken },
    });
    const { res } = makeRes();
    const next = makeNext();

    authMiddleware(req, res, next);

    expect((req as RequestWithUserId).userId).toBe("header-user");
  });

  it("returns 401 when no token is provided at all", () => {
    const req = makeReq({ headers: {}, cookies: {} });
    const { res, status, json } = makeRes();
    const next = makeNext();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ message: "Unauthorized" });
  });

  it("returns 401 when token is malformed", () => {
    const req = makeReq({ headers: { authorization: "not.a.valid.token" } });
    const { res, status } = makeRes();
    const next = makeNext();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });

  it("returns 401 when token is signed with wrong secret", () => {
    const token = jwt.sign({ userId: "user-1" }, "wrong-secret");
    const req = makeReq({ headers: { authorization: token } });
    const { res, status } = makeRes();
    const next = makeNext();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });

  it("returns 401 when token is expired", () => {
    const token = jwt.sign(
      { userId: "user-1" },
      JWT_SECRET,
      { expiresIn: -1 } // already expired
    );
    const req = makeReq({ headers: { authorization: token } });
    const { res, status } = makeRes();
    const next = makeNext();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });

  it("returns 401 for empty string token", () => {
    const req = makeReq({ headers: { authorization: "" }, cookies: {} });
    const { res, status } = makeRes();
    const next = makeNext();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });

  it("attaches userId as string to the request object", () => {
    const token = jwt.sign({ userId: "user-xyz" }, JWT_SECRET);
    const req = makeReq({ headers: { authorization: token } });
    const { res } = makeRes();
    const next = makeNext();

    authMiddleware(req, res, next);

    const userId = (req as RequestWithUserId).userId;
    expect(typeof userId).toBe("string");
    expect(userId).toBe("user-xyz");
  });
});
