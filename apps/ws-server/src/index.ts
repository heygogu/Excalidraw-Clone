import WebSocket, { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { prismaClient as prisma } from "@repo/db/client";
const wss = new WebSocketServer({ port: 8080 });

interface Room {
    roomId: string,
    users: User[]
}

interface User {
    userId: string,
    ws: WebSocket
}

const rooms: Room[] = []

let users: User[] = []


function checkUserWithToken(token: string): string | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET)
        if (typeof decoded === "string") {
            return null;
        }

        if (!decoded || decoded.userId == null) {
            return null;
        }
        return decoded.userId;
    } catch (error) {
        return null
    }

}
wss.on("connection", function connection(ws, request) {

    const url = request.url;
    if (!url) return;

    const queryParams = new URLSearchParams(url.split("?")[1]);

    const token = queryParams.get("token") || "";

    const userId = checkUserWithToken(token);

    if (!userId) {
        ws.close(4001, "Unauthorized");
        return;
    }

    users.push({
        userId,
        ws
    })

    ws.on('message', async function message(data) {
        let parsedData;

        if (typeof data != "string") {
            parsedData = JSON.stringify(data.toString());
        } else { //{type:"join-room",roomId:100}
            try {
                parsedData = JSON.parse(data);
            } catch (err) {
                console.error("Invalid JSON received:");
                return;
            }
        }

        if (parsedData.type == "join-room") {
            const user = users.find(x => x.ws == ws)
            if (!user) return;
            let room = rooms.find(x => x.roomId == parsedData.roomId)
            if (!room) {
                room = { roomId: parsedData.roomId, users: [] };
                rooms.push(room);
            }
            room?.users.push(user)

        }

        if (parsedData.type == "leave-room") {
            const room = rooms.find(x => x.roomId == parsedData.roomId)
            if (room && room.users) {
                room.users = room?.users.filter(x => x.ws != ws)
            }

            users = users.filter(x => x.ws != ws)

            if (room && room.users.length === 0) {
                rooms.splice(rooms.indexOf(room), 1);
            }

        }

        if (parsedData.type == "chat") {
            const msg = parsedData.message;
            const roomId = parsedData.roomId;

            const user = users.find(u => u.ws == ws)
            if (!user) return
            await prisma.chat.create({
                data: {
                    message: msg,
                    roomId,
                    userId: userId

                }
            })

            //find out the room
            const room = rooms.find(x => x.roomId == roomId)

            room?.users.forEach(user => user.ws.send(
                JSON.stringify({
                    type: "chat",
                    message: msg,
                    roomId,
                    senderId: userId
                })
            ))
        }


    })


    ws.on("close", () => {
        users = users.filter(u => u.ws !== ws);
        rooms.forEach(room => {
            room.users = room.users.filter(u => u.ws !== ws);
        });
    });




})