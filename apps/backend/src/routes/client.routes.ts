import { Router } from "express";
import { createClient, listClients } from "../controllers/client.controller.js";

export const clientRouter = Router();

clientRouter.get("/", listClients);
clientRouter.post("/", createClient);

