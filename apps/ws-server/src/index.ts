import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
const wss = new WebSocketServer({ port: 8080 });


function checkToken(token: string) {
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

    const userId = checkToken(token);

    if (!userId) {
        ws.close(4001, "Unauthorized");
        return;
    }

    //push the user, room array and the ws into the array
    ws.on("message", async function message(data) {
        //return with a pong
        ws.send("pong");
    });
})