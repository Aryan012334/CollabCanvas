/**
 * Unit tests for verifyToken() — the WebSocket authentication function.
 * No network, no DB — pure function testing.
 */

import jwt from "jsonwebtoken";
import { verifyToken } from "../utils/auth";

const JWT_SECRET = "123";

describe("verifyToken()", () => {
  it("returns payload with userId for a valid token", () => {
    const token = jwt.sign({ userId: "ws-user-1", name: "Aryan" }, JWT_SECRET);
    const payload = verifyToken(token);

    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe("ws-user-1");
    expect(payload!.name).toBe("Aryan");
  });

  it("returns null for an empty string", () => {
    expect(verifyToken("")).toBeNull();
  });

  it("returns null for a completely random string", () => {
    expect(verifyToken("this.is.not.a.jwt")).toBeNull();
  });

  it("returns null when signed with a different secret", () => {
    const token = jwt.sign({ userId: "user-1" }, "wrong-secret");
    expect(verifyToken(token)).toBeNull();
  });

  it("returns null for an expired token", () => {
    const token = jwt.sign({ userId: "user-1" }, JWT_SECRET, { expiresIn: -1 });
    expect(verifyToken(token)).toBeNull();
  });

  it("returns null when payload has no userId field", () => {
    // Token is valid but missing userId — should be rejected
    const token = jwt.sign({ name: "No ID user" }, JWT_SECRET);
    expect(verifyToken(token)).toBeNull();
  });

  it("returns null for a tampered token (modified payload)", () => {
    const token = jwt.sign({ userId: "user-1" }, JWT_SECRET);
    // Tamper middle section (payload) of the JWT
    const parts = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ userId: "hacker-999" })
    ).toString("base64url");
    const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    expect(verifyToken(tampered)).toBeNull();
  });

  it("returns correct userId when token was generated with numeric-like userId", () => {
    const token = jwt.sign({ userId: "12345", name: "NumericUser" }, JWT_SECRET);
    const payload = verifyToken(token);

    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe("12345");
  });

  it("returns name as undefined when not included in token", () => {
    const token = jwt.sign({ userId: "user-no-name" }, JWT_SECRET);
    const payload = verifyToken(token);

    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe("user-no-name");
    expect(payload!.name).toBeUndefined();
  });
});
