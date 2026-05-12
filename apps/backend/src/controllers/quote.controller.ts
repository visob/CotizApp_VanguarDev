import type { Request, Response } from "express";

export async function listQuotes(_req: Request, res: Response) {
  res.status(501).json({ ok: false, error: "list_quotes_not_implemented" });
}

export async function createQuote(_req: Request, res: Response) {
  res.status(501).json({ ok: false, error: "create_quote_not_implemented" });
}

