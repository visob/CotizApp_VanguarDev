import type { Request, Response } from "express";

export async function listProducts(_req: Request, res: Response) {
  res.status(501).json({ ok: false, error: "list_products_not_implemented" });
}

export async function createProduct(_req: Request, res: Response) {
  res.status(501).json({ ok: false, error: "create_product_not_implemented" });
}

