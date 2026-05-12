import { Router } from "express";
import { createQuote, listQuotes } from "../controllers/quote.controller.js";
import { addTrackingEvent } from "../controllers/tracking.controller.js";

export const quoteRouter = Router();

quoteRouter.get("/", listQuotes);
quoteRouter.post("/", createQuote);
quoteRouter.post("/:id/tracking", addTrackingEvent);

