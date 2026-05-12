import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../services/auth.service.js";

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  const token = header.slice("bearer ".length).trim();
  const user = verifyAccessToken(token);
  if (!user) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  req.user = user;
  next();
}
