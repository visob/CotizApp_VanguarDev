import { Router } from "express";
import { createProduct, listProducts } from "../controllers/product.controller.js";

export const productRouter = Router();

productRouter.get("/", listProducts);
productRouter.post("/", createProduct);

