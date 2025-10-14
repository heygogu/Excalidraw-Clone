import express, { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { authMiddleware, RequestWithUserId } from "./middleware";
import { CreateUserSchema, SignInSchema, CreateRoomSchema } from "@repo/common/schema"
import { prismaClient as prisma } from "@repo/db/client";
import cors from "cors";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";

const app = express();
app.use(express.json());

app.use(cookieParser())
app.use(cors(
    {
        origin: "http://localhost:3000",
        credentials: true
    }
))

app.post("/signup", async (req, res) => {

    console.log(req.body)

    try {
        const parsedData = CreateUserSchema.safeParse(req.body);

        if (!parsedData.success) {
            console.log(parsedData.error)
            res.json({
                message: "Incorrect inputs"
            })
            return;
        }

        const user = parsedData.data

        const hashedPassword = await bcrypt.hash(user.password, 10);
        const returnedUser = await prisma.user.create({
            data: {
                name: user.name,
                email: user.email,
                password: hashedPassword
            }
        })

        res.json({
            message: "User created successfully",
            data: {
                userId: returnedUser.id
            }
        })

    } catch (error) {
        res.status(400).json({
            error: "Error creating the user"
        })
    }

});

app.post("/login", async (req, res) => {


    try {

        const parsedData = SignInSchema.safeParse(req.body);
        if (!parsedData.success) {
            console.log(parsedData.error)
            res.json({
                message: "Incorrect inputs"
            })
            return;
        }
        const { email, password } = parsedData.data

        const user = await prisma.user.findUnique({
            where: {
                email: email
            }
        })

        if (!user) {
            res.status(400).json({
                message: "Incorrect email or password"
            })
            return;
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password)

        if (!isPasswordCorrect) {
            res.status(400).json({
                message: "Incorrect email or password"
            })
            return;
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET);
        res.cookie("token", token, {
            httpOnly: true,
            sameSite: "none",
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 30, // 30 days
            path: "/",
            domain: "localhost",
        }).json({
            message: "Login successful",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                photo: user.photo || "",
                token: token
            },
        });

    } catch (error) {
        res.status(400).json({
            message: "Incorrect email or password"
        })
    }

});

app.get("/me", async (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: "Not authenticated" });

    try {
        const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
        const user = await prisma.user.findUnique({ where: { id: payload.userId } });

        if (!user) return res.status(401).json({ message: "User not found" });

        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            photo: user.photo || "",
            token: token
        });
    } catch {
        res.status(401).json({ message: "Invalid token" });
    }
});



app.post("/room", authMiddleware, async (req, res) => {


    try {
        const parsedData = CreateRoomSchema.safeParse(req.body);

        if (!parsedData.success) {
            console.log(parsedData.error)

            res.json({
                message: "Incorrect inputs"
            })
            return;
        }

        const userId = (req as RequestWithUserId).userId;

        const room = await prisma.room.create({
            data: {
                slug: parsedData.data.name,
                adminId: userId
            }
        })

        res.json({
            message: "Room created successfully",
            data: {
                roomId: room.id
            }
        })

    } catch (error) {
        console.log(error)
        res.status(400).json({
            message: "Error creating the room",

        })
    }

    //create a room and return 
});

app.get("/shapes/:roomId", authMiddleware, async (req, res) => {

    try {
        const roomId = Number(req.params.roomId);
        //get all the messages of that room
        const messages = await prisma.shape.findMany({
            where: {
                roomId: roomId
            },
            orderBy: {
                id: "desc"
            },
            take: 1000
        })

        res.json({
            messages
        })
    } catch (error) {
        console.log(error)
        res.status(400).json({
            messages: [],
            message: "Something went wrong"
        })
    }
})


app.get("/room/:slug", async (req, res) => {
    try {
        const slug = req.params.slug

        const room = await prisma.room.findFirst({
            where: {
                slug
            }
        })
        res.json({
            room
        })
    } catch (error) {

    }
})

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    const message = err.message || 'Internal Server Error'
    res.status(400).json({
        status: 'error',
        message,
    });
});


app.listen(3001, () => {
    console.log("Server started listening on port 3001")
})