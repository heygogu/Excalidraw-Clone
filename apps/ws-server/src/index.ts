import { WebSocketServer } from "ws";
import { verifyToken } from "./utils/auth";
import { addUser, removeUser } from "./state";
import { handleEvent } from "./events/handlers";

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws, req) => {
    const url = req.url;
    if (!url) return ws.close(4001, "Missing URL");

    const params = new URLSearchParams(url.split("?")[1]);
    const token = params.get("token") || "";

    const payload = verifyToken(token);
    if (!payload) return ws.close(4002, "Unauthorized");

    const user = { userId: payload.userId, name: payload.name ?? "John", ws };
    addUser(user);


    ws.on("message", (raw) => {
        try {
            const data = JSON.parse(raw.toString());
            console.log(data)
            //push roomId to rooms

            handleEvent(user, data);
        } catch {
            ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
        }
    });

    ws.on("close", () => removeUser(user.userId));
});

console.log("WS server running on ws://localhost:8080");
