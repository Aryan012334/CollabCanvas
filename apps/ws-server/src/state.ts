import WebSocket from "ws";

export interface User {
    userId: string;
    name?: string;
    ws: WebSocket;
}

export const users = new Map<string, User>();
export const rooms = new Map<string, Set<User>>();

export function addUser(user: User) {
    users.set(user.userId, user);
}

export function removeUser(userId: string) {
    const user = users.get(userId);
    if (!user) return;

    // Remove user from all rooms and notify others
    for (const [roomId, room] of rooms.entries()) {
        if (room.has(user)) {
            room.delete(user);

            // Notify remaining users in this room
            room.forEach(u => {
                if (u.ws.readyState === WebSocket.OPEN) {
                    u.ws.send(JSON.stringify({
                        type: "user_left",
                        userId: user.userId,
                        username: user.name,
                        roomId: roomId
                    }));
                }
            });

            console.log(`User ${user.name} removed from room ${roomId}. Room size: ${room.size}`);
        }

        if (room.size === 0) {
            rooms.delete(roomId);
            console.log(`Room ${roomId} deleted (empty)`);
        }
    }

    users.delete(userId);
    console.log(`User ${user.name} (${userId}) completely removed`);
}

export function joinRoom(roomId: string, user: User) {
    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId)!.add(user);
    return rooms.get(roomId)!;
}

export function leaveRoom(roomId: string, user: User) {
    const room = rooms.get(roomId);
    if (!room) return;
    room.delete(user);
    if (room.size === 0) rooms.delete(roomId);
}

export function broadcastToRoom(roomId: string, data: any) {
    const room = rooms.get(roomId);
    if (!room) return;
    room.forEach(u => u.ws.send(JSON.stringify(data)));
}
