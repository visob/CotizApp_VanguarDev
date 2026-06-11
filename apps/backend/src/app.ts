import express from "express";
import { pool } from "./config/database.js";
import { login } from "./controllers/auth.controller.js";
import { authMiddleware } from "./middlewares/auth.middleware.js";
import { roleMiddleware } from "./middlewares/role.middleware.js";
import { authRouter } from "./routes/auth.routes.js";
import { clientRouter } from "./routes/client.routes.js";
import { productRouter } from "./routes/product.routes.js";
import { quoteRouter } from "./routes/quote.routes.js";
import { configRouter } from "./routes/config.routes.js";

export const app = express();

app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  if (requestOrigin) {
    const allowLocalDevOrigin =
      allowedOrigins.length === 0 &&
      (requestOrigin.startsWith("http://localhost:") ||
        requestOrigin.startsWith("http://127.0.0.1:"));

    if (allowedOrigins.includes(requestOrigin) || allowLocalDevOrigin) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin);
      res.setHeader("Vary", "Origin");
    }
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/health/db", async (_req, res) => {
  try {
    const result = await pool.query<{ ok: number }>("select 1 as ok");
    res.json({ ok: true, db: result.rows[0]?.ok === 1 });
  } catch (error) {
    res.status(503).json({
      ok: false,
      db: false,
      error: error instanceof Error ? error.message : "db_error"
    });
  }
});

app.post("/login", login);
app.use("/api/auth", authRouter);
app.use(
  "/api/clients",
  authMiddleware,
  roleMiddleware(["Admin", "Vendedor", "Gerente"]),
  clientRouter
);
app.use(
  "/api/products",
  authMiddleware,
  roleMiddleware(["Admin", "Vendedor", "Gerente"]),
  productRouter
);
app.use(
  "/api/quotes",
  authMiddleware,
  roleMiddleware(["Admin", "Vendedor", "Gerente"]),
  quoteRouter
);
app.use(
  "/api/config",
  authMiddleware,
  roleMiddleware(["Admin", "Gerente"]),
  configRouter
);
