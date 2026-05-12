import type { Request, Response } from "express";
import { loginWithPassword } from "../services/auth.service.js";

export async function login(req: Request, res: Response) {
  const email = typeof req.body?.email === "string" ? req.body.email : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !password) {
    res.status(400).json({ ok: false, error: "invalid_request" });
    return;
  }

  const result = await loginWithPassword({ email, password });

  if (!result.ok) {
    if (result.reason === "locked") {
      res.status(423).json({
        ok: false,
        error: "account_locked",
        lockUntilMs: result.lockUntilMs
      });
      return;
    }

    res.status(401).json({ ok: false, error: "invalid_credentials" });
    return;
  }

  res.json({
    ok: true,
    token: result.token,
    user: result.user
  });
}

export async function register(_req: Request, res: Response) {
  res.status(501).json({ ok: false, error: "register_not_implemented" });
}
