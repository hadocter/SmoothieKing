import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/auth";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    email: string;
    nickname: string;
  };
}

/** Reads and verifies the Bearer token, if one is present and valid. */
function resolveUser(req: AuthenticatedRequest): AuthenticatedRequest["user"] | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const payload = verifyToken(authHeader.slice(7));
  if (!payload) return null;

  return {
    userId: payload.userId,
    email: payload.email,
    nickname: payload.nickname,
  };
}

/** Rejects the request with 401 unless a valid token is present. */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const user = resolveUser(req);

  if (!user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  req.user = user;
  next();
}

/**
 * Attaches `req.user` when a valid token is present, but never rejects.
 * Used by endpoints that must still work for signed-out visitors — e.g. browsing
 * recipes without an account, where the favorites list is simply empty.
 */
export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const user = resolveUser(req);
  if (user) req.user = user;
  next();
}
