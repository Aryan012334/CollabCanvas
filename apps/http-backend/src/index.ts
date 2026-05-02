import express, { NextFunction, Request, Response } from "express";
import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

import cron from "node-cron";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { authMiddleware, RequestWithUserId } from "./middleware";
import {
  CreateUserSchema,
  SignInSchema,
  CreateRoomSchema,
} from "@repo/common/schema";
import { prismaClient as prisma } from "@repo/db/client";
import cors from "cors";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";

const app = express();
app.use(express.json());

app.use(cookieParser());
app.use(
  cors({
    origin: "https://collabdraw.showcase.wiki",
    credentials: true,
  }),
);

app.get("/health", async (_, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true });
});

app.post("/signup", async (req, res) => {
  try {
    const parsedData = CreateUserSchema.safeParse(req.body);

    if (!parsedData.success) {
      res.json({
        message: "Incorrect inputs",
      });
      return;
    }

    const user = parsedData.data;

    const hashedPassword = await bcrypt.hash(user.password, 10);
    const returnedUser = await prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        password: hashedPassword,
      },
    });

    res.json({
      message: "User created successfully",
      data: {
        userId: returnedUser.id,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "error creating the user",
      debug: error instanceof Error ? error.message : error,
    });
  }
});

app.post("/login", async (req, res) => {
  try {
    const parsedData = SignInSchema.safeParse(req.body);
    if (!parsedData.success) {
      res.json({
        message: "Incorrect inputs",
      });
      return;
    }
    const { email, password } = parsedData.data;

    const user = await prisma.user.findUnique({
      where: {
        email: email,
      },
    });

    if (!user) {
      res.status(400).json({
        message: "Incorrect email or password",
      });
      return;
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      res.status(400).json({
        message: "Incorrect email or password",
      });
      return;
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res
      .cookie("token", token, {
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      })
      .json({
        message: "Login successful",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          photo: user.photo || "",
          token: token,
        },
      });
  } catch (error) {
    res.status(400).json({
      message: "Incorrect email or password",
    });
  }
});

app.get("/me", authMiddleware, async (req, res) => {
  const userId = (req as RequestWithUserId).userId;

  if (!userId) {
    res.status(401).json({
      message: "Unauthorized",
    });
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) return res.status(401).json({ message: "User not found" });

    res.json({
      user,
    });
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
});

app.post("/room", authMiddleware, async (req, res) => {
  try {
    const parsedData = CreateRoomSchema.safeParse(req.body);

    if (!parsedData.success) {
      res.json({
        message: "Incorrect inputs",
      });
      return;
    }

    const userId = (req as RequestWithUserId).userId;

    const room = await prisma.room.create({
      data: {
        slug: parsedData.data.name,
        adminId: userId,
      },
    });

    res.json({
      message: "Room created successfully",
      data: {
        roomId: room.id,
      },
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(", ")
        : "field";

      return res.status(400).json({
        message: `Room with this name already exists.`,
      });
    }

    console.error("Room creation error:", error);
    return res.status(500).json({
      message: "Something went wrong while creating the room.",
    });
  }

  //create a room and return
});

app.delete("/room/:roomId", authMiddleware, async (req, res) => {
  try {
    const roomId = Number(req.params.roomId);
    const userId = (req as RequestWithUserId).userId;
    if (isNaN(roomId)) {
      return res.status(400).json({
        message: "Invalid room ID",
      });
    }
    // const room = await prisma.room.findUnique({
    //     where: {
    //         id: roomId
    //     }
    // })

    // if (!room) {
    //     return res.status(404).json({
    //         message: "Room not found"
    //     })
    // }

    await prisma.room.delete({
      where: {
        id: roomId,
        adminId: userId,
      },
    });

    res.json({
      message: "Room deleted successfully",
    });
  } catch (error) {
    console.error("Room deletion error:", error);
    return res.status(500).json({
      message: "Something went wrong while deleting the room.",
    });
  }
});

app.get("/shapes/:roomId", authMiddleware, async (req, res) => {
  try {
    const roomId = Number(req.params.roomId);
    //get all the messages of that room
    const shapes = await prisma.shape.findMany({
      where: {
        roomId: roomId,
      },
      orderBy: {
        id: "desc",
      },
      take: 1000,
    });

    res.json(shapes);
  } catch (error) {
    res.status(400).json({
      shapes: [],
      message: "Something went wrong",
    });
  }
});

app.get("/room/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;

    const room = await prisma.room.findFirst({
      where: {
        slug,
      },
    });
    res.json({
      room,
    });
  } catch (error) {}
});

app.get("/rooms", authMiddleware, async (req, res) => {
  const userId = (req as RequestWithUserId).userId;

  try {
    const rooms = await prisma.room.findMany({
      where: {
        deletedAt: null,
        // OR: [
        //     {
        //         participants: {
        //             some: {
        //                 userId: userId,
        //             },
        //         },
        //     },
        //     {
        //         adminId: userId,
        //     },
        // ],
      },
      include: {
        participants: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    res.json({
      rooms,
    });
  } catch (error) {}
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  const message = err.message || "Internal Server Error";
  res.status(400).json({
    status: "error",
    message,
  });
});

app.listen(3000, () => {
  console.log("Server started listening on port 3000");
  cron.schedule("*/14 * * * *", async () => {
    try {
      console.log(" Running internal health cron...");

      await prisma.$queryRaw`SELECT 1`;
      //   await axios.get("http://localhost:" + 3000 + "/health");

      console.log(" Health + DB ping success");
    } catch (err) {
      console.error(" Cron failed:", err);
    }
  });
});
