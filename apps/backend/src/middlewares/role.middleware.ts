import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "../types/index.js";

export function roleMiddleware(roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }

    if (!roles.includes(req.user.rol)) {
      res.status(403).json({ ok: false, error: "forbidden" });
      return;
    }

    next();
  };
}
