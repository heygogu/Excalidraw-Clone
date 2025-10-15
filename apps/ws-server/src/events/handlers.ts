import { User, rooms } from "../state";
import { prismaClient as prisma } from "@repo/db/client";

import { ShapeType } from "@repo/db/client";
interface Job {
    type: "chat" | "shape:create" | "shape:update";
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
            } else if (job.type === "shape:create") {

                await prisma.shape.create({
                    data: {
                        roomId: Number(job.roomId),
                        userId: job.userId,
                        type: ShapeType[job.payload.type as keyof typeof ShapeType],
                        strokeColor: job.payload.strokeColor ?? "black",
                        fillColor: job.payload.fillColor ?? "transparent",
                        strokeWidth: job.payload.strokeWidth ?? 1,
                        strokeStyle: job.payload.strokeStyle ?? "solid",
                        fillStyle: job.payload.fillStyle ?? "solid",
                        points: job.payload.points ?? [],
                        text: job.payload.text ?? "",
                        fontSize: job.payload.fontSize ?? 12,
                        startX: job.payload.startX ?? 0,
                        startY: job.payload.startY ?? 0,
                        width: job.payload.width ?? 0,
                        height: job.payload.height ?? 0,

                    },
                });
            }
            else if (job.type === "shape:update") {
                await prisma.shape.update({
                    where: {
                        id: job.payload.id,
                    },
                    data: {
                        startX: job.payload.startX,
                        startY: job.payload.startY,
                        width: job.payload.width,
                        height: job.payload.height,
                        type: job.payload.type,
                        strokeColor: job.payload.strokeColor,
                        fillColor: job.payload.fillColor,
                        strokeWidth: job.payload.strokeWidth,
                        strokeStyle: job.payload.strokeStyle,
                        fillStyle: job.payload.fillStyle,
                        points: job.payload.points,
                        text: job.payload.text,
                        fontSize: job.payload.fontSize,
                    },
                });
            }
        } catch (err) {
            console.error("DB write failed, retrying:", err);
            queue.push(job); // retry
            await new Promise(r => setTimeout(r, 1000)); // backoff
        }
    }

    processing = false;
}


export function handleEvent(user: User, data: any) {
    switch (data.type) {
        case "join-room": {

            //add a new room with this id
            //check if the room is not in the rooms map
            if (!rooms.has(data.roomId)) {
                rooms.set(data.roomId, new Set());
            }
            const room = rooms.get(data.roomId);

            if (!room) {
                console.log("room not found")
                return;
            }
            room.add(user);


            // notify other users
            room.forEach(u => {
                if (u.ws !== user.ws) u.ws.send(JSON.stringify({ type: "user_joined", userId: user?.name }));
            });
            break;
        }

        case "leave-room": {
            const room = rooms.get(data.roomId);
            if (room) {
                room.delete(user);
                if (room.size === 0) rooms.delete(data.roomId);
                user.ws.send(JSON.stringify({ type: "user_left_room", userId: user?.name }));
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
                    userId: user.userId,
                    username: user.name,
                })));
            }

            // enqueue DB write
            enqueue({ type: "chat", roomId: data.roomId, userId: user.userId, payload: { message: data.message } });
            break;
        }

        case "shape:create": {
            const room = rooms.get(data.roomId);
            if (room) {
                room.forEach(u => u.ws.send(JSON.stringify({
                    type: "shape:create",
                    shape: data.shape,
                    roomId: data.roomId,
                    userId: user.userId,
                    username: user?.name,
                })));
            }
            enqueue({ type: "shape:create", roomId: data.roomId, userId: user.userId, payload: data.shape });
            break;
        }

        case "shape:update": {
            const room = rooms.get(data.roomId);
            if (room) {
                room.forEach(u => u.ws.send(JSON.stringify({
                    type: "shape:update",
                    shape: data.shape,
                    roomId: data.roomId,
                    userId: user.userId,
                    username: user.name,
                })));
            }

            enqueue({ type: "shape:update", roomId: data.roomId, userId: user.userId, payload: data.shape });
            break;
        }

        default:
            user.ws.send(JSON.stringify({ type: "error", message: "Unknown event type" }));
    }
}
