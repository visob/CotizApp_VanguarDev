import { Router } from "express";
import {
  createQuoteHandler,
  getQuotePdfHandler,
  listQuotesHandler,
  listReactivationAlertsHandler,
  getQuoteHandler,
  updateQuoteHandler
} from "../controllers/quote.controller.js";
import { addTrackingEvent, listTrackingEvents } from "../controllers/tracking.controller.js";

export const quoteRouter = Router();

quoteRouter.get("/", listQuotesHandler);
quoteRouter.get("/reactivation-alerts", listReactivationAlertsHandler);
quoteRouter.post("/", createQuoteHandler);
quoteRouter.get("/:id", getQuoteHandler);
quoteRouter.patch("/:id", updateQuoteHandler);
quoteRouter.get("/:id/pdf", getQuotePdfHandler);
quoteRouter.get("/:id/tracking", listTrackingEvents);
quoteRouter.post("/:id/tracking", addTrackingEvent);
