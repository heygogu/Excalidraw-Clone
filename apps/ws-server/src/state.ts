import WebSocket from "ws";

export interface User {
    userId: string;
    ws: WebSocket;
}

export const users = new Map<string, User>(); // userId -> User
export const rooms = new Map<string, Set<User>>(); // roomId -> Set<User>

export function addUser(user: User) {
    users.set(user.userId, user);
}

export function removeUser(userId: string) {
    const user = users.get(userId);
    if (!user) return;

    // remove user from all rooms
    for (const [roomId, room] of rooms.entries()) {
        room.delete(user);
        if (room.size === 0) rooms.delete(roomId);
    }

    users.delete(userId);
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
