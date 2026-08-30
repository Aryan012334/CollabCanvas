/**
 * Unit tests for state.ts — the in-memory room/user state management.
 * Tests the core real-time collaboration logic: joining, leaving, broadcasting.
 */

import WebSocket from "ws";
import {
  users,
  rooms,
  addUser,
  removeUser,
  joinRoom,
  leaveRoom,
  broadcastToRoom,
  User,
} from "../state";

// ─── Helper: create a fake WebSocket ─────────────────────────────────────────
function makeFakeWs(readyState: number = WebSocket.OPEN): WebSocket {
  return {
    send: jest.fn(),
    readyState,
    close: jest.fn(),
  } as unknown as WebSocket;
}

function makeUser(userId: string, name: string = "Test"): User {
  return { userId, name, ws: makeFakeWs() };
}

// ─── Clean up state before each test ─────────────────────────────────────────
beforeEach(() => {
  users.clear();
  rooms.clear();
});

// ─── addUser ─────────────────────────────────────────────────────────────────
describe("addUser()", () => {
  it("adds a user to the users map", () => {
    const user = makeUser("u1");
    addUser(user);
    expect(users.has("u1")).toBe(true);
    expect(users.get("u1")).toBe(user);
  });

  it("overwrites an existing user with the same userId (reconnect scenario)", () => {
    const user1 = makeUser("u1", "First Connection");
    const user2 = makeUser("u1", "Reconnection");
    addUser(user1);
    addUser(user2);
    expect(users.get("u1")).toBe(user2);
  });

  it("can add multiple users independently", () => {
    addUser(makeUser("u1"));
    addUser(makeUser("u2"));
    addUser(makeUser("u3"));
    expect(users.size).toBe(3);
  });
});

// ─── removeUser ──────────────────────────────────────────────────────────────
describe("removeUser()", () => {
  it("removes user from users map", () => {
    const user = makeUser("u1");
    addUser(user);
    removeUser("u1");
    expect(users.has("u1")).toBe(false);
  });

  it("removes user from all rooms they were in", () => {
    const user = makeUser("u1");
    addUser(user);
    joinRoom("room-1", user);
    joinRoom("room-2", user);

    removeUser("u1");

    expect(rooms.get("room-1")).toBeUndefined();
    expect(rooms.get("room-2")).toBeUndefined();
  });

  it("broadcasts user_left event to remaining users in the room", () => {
    const userA = makeUser("u1", "Alice");
    const userB = makeUser("u2", "Bob");
    addUser(userA);
    addUser(userB);
    joinRoom("room-1", userA);
    joinRoom("room-1", userB);

    removeUser("u1");

    expect(userB.ws.send).toHaveBeenCalledTimes(1);
    const message = JSON.parse((userB.ws.send as jest.Mock).mock.calls[0][0]);
    expect(message.type).toBe("user_left");
    expect(message.userId).toBe("u1");
    expect(message.roomId).toBe("room-1");
  });

  it("deletes empty room after last user leaves", () => {
    const user = makeUser("u1");
    addUser(user);
    joinRoom("room-empty", user);
    removeUser("u1");
    expect(rooms.has("room-empty")).toBe(false);
  });

  it("does nothing gracefully when userId does not exist", () => {
    expect(() => removeUser("non-existent-user")).not.toThrow();
  });

  it("does not send user_left to disconnected sockets", () => {
    const userA = makeUser("u1");
    const userB = { ...makeUser("u2"), ws: makeFakeWs(WebSocket.CLOSED) };
    addUser(userA);
    addUser(userB);
    joinRoom("room-1", userA);
    joinRoom("room-1", userB);

    removeUser("u1");

    // userB has CLOSED socket — should NOT receive send()
    expect(userB.ws.send).not.toHaveBeenCalled();
  });
});

// ─── joinRoom ─────────────────────────────────────────────────────────────────
describe("joinRoom()", () => {
  it("creates a new room and adds the user", () => {
    const user = makeUser("u1");
    addUser(user);
    const room = joinRoom("room-new", user);

    expect(rooms.has("room-new")).toBe(true);
    expect(room.has(user)).toBe(true);
  });

  it("adds user to an existing room", () => {
    const u1 = makeUser("u1");
    const u2 = makeUser("u2");
    joinRoom("room-shared", u1);
    joinRoom("room-shared", u2);

    expect(rooms.get("room-shared")!.size).toBe(2);
  });

  it("does not add the same user twice", () => {
    const user = makeUser("u1");
    joinRoom("room-1", user);
    joinRoom("room-1", user); // rejoin same room

    expect(rooms.get("room-1")!.size).toBe(1);
  });

  it("allows one user to be in multiple rooms simultaneously", () => {
    const user = makeUser("u1");
    joinRoom("room-a", user);
    joinRoom("room-b", user);

    expect(rooms.get("room-a")!.has(user)).toBe(true);
    expect(rooms.get("room-b")!.has(user)).toBe(true);
  });
});

// ─── leaveRoom ────────────────────────────────────────────────────────────────
describe("leaveRoom()", () => {
  it("removes user from the specified room", () => {
    const user = makeUser("u1");
    joinRoom("room-1", user);
    leaveRoom("room-1", user);

    expect(rooms.get("room-1")).toBeUndefined();
  });

  it("only removes user from the specified room, not others", () => {
    const user = makeUser("u1");
    joinRoom("room-a", user);
    joinRoom("room-b", user);
    leaveRoom("room-a", user);

    expect(rooms.has("room-a")).toBe(false);
    expect(rooms.get("room-b")!.has(user)).toBe(true);
  });

  it("does nothing when room does not exist", () => {
    const user = makeUser("u1");
    expect(() => leaveRoom("non-existent", user)).not.toThrow();
  });

  it("deletes the room when the last user leaves", () => {
    const user = makeUser("u1");
    joinRoom("room-solo", user);
    leaveRoom("room-solo", user);
    expect(rooms.has("room-solo")).toBe(false);
  });
});

// ─── broadcastToRoom ──────────────────────────────────────────────────────────
describe("broadcastToRoom()", () => {
  it("sends message to all users in the room", () => {
    const u1 = makeUser("u1");
    const u2 = makeUser("u2");
    const u3 = makeUser("u3");
    joinRoom("broadcast-room", u1);
    joinRoom("broadcast-room", u2);
    joinRoom("broadcast-room", u3);

    broadcastToRoom("broadcast-room", { type: "shape:create", data: "test" });

    expect(u1.ws.send).toHaveBeenCalledTimes(1);
    expect(u2.ws.send).toHaveBeenCalledTimes(1);
    expect(u3.ws.send).toHaveBeenCalledTimes(1);

    const msg = JSON.parse((u1.ws.send as jest.Mock).mock.calls[0][0]);
    expect(msg.type).toBe("shape:create");
  });

  it("sends JSON-stringified message", () => {
    const user = makeUser("u1");
    joinRoom("room-1", user);

    broadcastToRoom("room-1", { type: "ping" });

    const sent = (user.ws.send as jest.Mock).mock.calls[0][0];
    expect(typeof sent).toBe("string");
    expect(JSON.parse(sent)).toEqual({ type: "ping" });
  });

  it("does nothing when the room does not exist", () => {
    // Should not throw
    expect(() =>
      broadcastToRoom("ghost-room", { type: "test" })
    ).not.toThrow();
  });

  it("does nothing when the room is empty", () => {
    rooms.set("empty-room", new Set());
    expect(() =>
      broadcastToRoom("empty-room", { type: "test" })
    ).not.toThrow();
  });
});
