import { JWT_SECRET } from "@repo/backend-common/config";
import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

export interface RequestWithUserId extends Request {
    userId: string;
}
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    let token = req.headers.authorization;

    if (!token) {
        token = req.cookies.token;
    }

    if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
        (req as RequestWithUserId).userId = decoded.userId;
        next();
    } catch (err) {
        res.status(401).json({ message: "Unauthorized" });
    }
}