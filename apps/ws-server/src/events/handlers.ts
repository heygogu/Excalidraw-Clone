import { User, rooms } from "../state";
import { prismaClient as prisma } from "@repo/db/client";

// In-memory queue for DB writes
interface Job {
    type: "chat" | "shape";
    roomId: string;
    userId: string;
    payload: any;
}

const queue: Job[] = [];
let processing = false;

export function enqueue(job: Job) {
    queue.push(job);
    processQueue();
}

async function processQueue() {
    if (processing) return;
    processing = true;

    while (queue.length > 0) {
        const job = queue.shift()!;
        try {
            if (job.type === "chat") {
                await prisma.chat.create({
                    data: {
                        roomId: Number(job.roomId),
                        userId: job.userId,
                        message: job.payload.message,
                    },
                });
            } else if (job.type === "shape") {
                // await prisma.shape.create({
                //     data: {
                //         roomId: job.roomId,
                //         userId: job.userId,
                //         type: job.payload.type,
                //         data: job.payload.data,
                //     },
                // });
            }
        } catch (err) {
            console.error("DB write failed, retrying:", err);
            queue.push(job); // retry
            await new Promise(r => setTimeout(r, 1000)); // backoff
        }
    }

    processing = false;
}

// Handle events
export function handleEvent(user: User, data: any) {
    switch (data.type) {
        case "join-room": {
            const room = rooms.get(data.roomId);
            if (!room) {
                console.log("room not found")
                return;
            }
            room.add(user);
            rooms.set(data.roomId, room);

            // notify other users
            room.forEach(u => {
                if (u.ws !== user.ws) u.ws.send(JSON.stringify({ type: "user_joined", userId: user.userId }));
            });
            break;
        }

        case "leave-room": {
            const room = rooms.get(data.roomId);
            if (room) {
                room.delete(user);
                if (room.size === 0) rooms.delete(data.roomId);
            }
            break;
        }

        case "chat": {
            // broadcast immediately
            const room = rooms.get(data.roomId);
            if (room) {
                room.forEach(u => u.ws.send(JSON.stringify({
                    type: "chat",
                    message: data.message,
                    roomId: data.roomId,
                    senderId: user.userId,
                })));
            }

            // enqueue DB write
            enqueue({ type: "chat", roomId: data.roomId, userId: user.userId, payload: { message: data.message } });
            break;
        }

        case "shape:update": {
            const room = rooms.get(data.roomId);
            if (room) {
                room.forEach(u => u.ws.send(JSON.stringify({
                    type: "shape:update",
                    shape: data.shape,
                    roomId: data.roomId,
                    senderId: user.userId,
                })));
            }

            // enqueue DB write
            enqueue({ type: "shape", roomId: data.roomId, userId: user.userId, payload: data.shape });
            break;
        }

        default:
            user.ws.send(JSON.stringify({ type: "error", message: "Unknown event type" }));
    }
}
