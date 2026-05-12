import { apiRequest } from "./apiClient";
import type { User } from "../types";

export async function login(input: { email: string; password: string }) {
  return apiRequest<{ token: string; user: User }>({
    path: "/login",
    method: "POST",
    body: input
  });
}
