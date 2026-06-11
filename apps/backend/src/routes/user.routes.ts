import { Router } from "express";
import {
  createUserHandler,
  deactivateUserHandler,
  getUserHandler,
  listUsersHandler,
  unlockUserHandler,
  updateUserHandler
} from "../controllers/user.controller.js";

export const userRouter = Router();

userRouter.get("/", listUsersHandler);
userRouter.get("/:id", getUserHandler);
userRouter.post("/", createUserHandler);
userRouter.put("/:id", updateUserHandler);
userRouter.patch("/:id/deactivate", deactivateUserHandler);
userRouter.patch("/:id/unlock", unlockUserHandler);
