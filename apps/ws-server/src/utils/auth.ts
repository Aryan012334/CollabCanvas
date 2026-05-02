import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { ShapeType } from "@repo/db/client";

export interface JwtPayload {
    userId: string;
    name?: string;
}

export type Job =
    | {
        type: "chat";
        roomId: number | string;
        userId: string;
        payload: { message: string };
    }
    | {
        type: "shape:create";
        roomId: number | string;
        userId: string;
        payload: {
            type: keyof typeof ShapeType;
            strokeColor?: string;
            fillColor?: string;
            strokeWidth?: number;
            strokeStyle?: string;
            fillStyle?: string;
            points?: number[][];
            text?: string;
            fontSize?: number;
            startX?: number;
            startY?: number;
            width?: number;
            height?: number;
        };
    }
    | {
        type: "shape:update";
        roomId: number | string;
        userId: string;
        payload: {
            id: number;
            type?: keyof typeof ShapeType;
            strokeColor?: string;
            fillColor?: string;
            strokeWidth?: number;
            strokeStyle?: string;
            fillStyle?: string;
            points?: number[][];
            text?: string;
            fontSize?: number;
            startX?: number;
            startY?: number;
            width?: number;
            height?: number;
        };
    };

export function verifyToken(token: string): JwtPayload | null {
    try {
        const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
        if (!payload || !payload.userId) return null;
        return payload;
    } catch {
        return null;
    }
}
