import express from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { authMiddleware, RequestWithUserId } from "./middleware";
import { CreateUserSchema, SignInSchema, CreateRoomSchema } from "@repo/common/schema"

const app = express();
app.use(express.json());

app.post("/signup", (req, res) => {

    const parsedData = CreateUserSchema.safeParse(req.body);

    if (!parsedData.success) {
        console.log(parsedData.error)
        res.json({
            message: "Incorrect inputs"
        })
        return;
    }

    try {

    } catch (error) {

    }

    //save to db later
});

app.post("/login", (req, res) => {


    const parsedData = SignInSchema.safeParse(req.body);

    if (!parsedData.success) {
        console.log(parsedData.error)

        res.json({
            message: "Incorrect inputs"
        })
        return;
    }

    try {

    } catch (error) {

    }

    //check if exists in the db

    //if yes then get the id and generate the jwt token
    const token = jwt.sign({ id: 1 }, JWT_SECRET);
    res.json({ token });
});



app.post("/create-room", authMiddleware, async (req, res) => {

    const parsedData = CreateRoomSchema.safeParse(req.body);

    if (!parsedData.success) {
        console.log(parsedData.error)

        res.json({
            message: "Incorrect inputs"
        })
        return;
    }

    const userId = (req as RequestWithUserId).userId;

    try {

    } catch (error) {

    }

    //create a room and return 
});

app.listen(3001, () => {
    console.log("Server started listening on port 3001")
})