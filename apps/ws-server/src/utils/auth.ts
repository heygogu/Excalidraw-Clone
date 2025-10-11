import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";

export interface JwtPayload {
    userId: string;
    name?: string;
}

export function verifyToken(token: string): JwtPayload | null {
    try {
        const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
        if (!payload || !payload.userId) return null;
        return payload;
    } catch {
        return null;
    }
}
