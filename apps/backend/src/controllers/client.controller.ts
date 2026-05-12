import type { Request, Response } from "express";

export async function listClients(_req: Request, res: Response) {
  res.status(501).json({ ok: false, error: "list_clients_not_implemented" });
}

export async function createClient(_req: Request, res: Response) {
  res.status(501).json({ ok: false, error: "create_client_not_implemented" });
}

