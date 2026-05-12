import type { Request, Response } from "express";

export async function addTrackingEvent(_req: Request, res: Response) {
  res.status(501).json({ ok: false, error: "tracking_not_implemented" });
}

