import { Router } from "express";
import * as configModel from "../models/config.model.js";

export const configRouter = Router();

// GET /api/config/:clave
configRouter.get("/:clave", async (req, res) => {
  try {
    const { clave } = req.params;
    const item = await configModel.getConfig(clave);
    if (!item) {
      return res.status(404).json({ error: "Configuracion no encontrada" });
    }
    res.json(item);
  } catch (error) {
    console.error("GET /config error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/config/:clave
configRouter.put("/:clave", async (req, res) => {
  try {
    const { clave } = req.params;
    const { valor } = req.body;
    
    if (valor === undefined) {
      return res.status(400).json({ error: "Se requiere un valor" });
    }
    
    const item = await configModel.setConfig(clave, String(valor));
    res.json(item);
  } catch (error) {
    console.error("PUT /config error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
