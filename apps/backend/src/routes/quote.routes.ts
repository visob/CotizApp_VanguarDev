import { Router } from "express";
import {
  createQuoteHandler,
  getQuotePdfHandler,
  listQuotesHandler
} from "../controllers/quote.controller.js";
import { addTrackingEvent } from "../controllers/tracking.controller.js";

export const quoteRouter = Router();

quoteRouter.get("/", listQuotesHandler);
quoteRouter.post("/", createQuoteHandler);
quoteRouter.get("/:id/pdf", getQuotePdfHandler);
quoteRouter.post("/:id/tracking", addTrackingEvent);
