jest.mock("../services/auth.service.js", () => ({
  loginWithPassword: jest.fn()
}));

import { login, register } from "./auth.controller.js";
import { loginWithPassword } from "../services/auth.service.js";

const mockLoginWithPassword = loginWithPassword as jest.MockedFunction<typeof loginWithPassword>;

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("auth.controller", () => {
  describe("login", () => {
    it("returns 400 when email is missing", async () => {
      const res = mockRes();
      await login({ body: { password: "test" } } as any, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ ok: false, error: "invalid_request" });
    });

    it("returns 400 when password is missing", async () => {
      const res = mockRes();
      await login({ body: { email: "a@b.com" } } as any, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns 401 on invalid credentials", async () => {
      mockLoginWithPassword.mockResolvedValue({ ok: false, reason: "invalid_credentials" });
      const res = mockRes();
      await login({ body: { email: "a@b.com", password: "wrong" } } as any, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ ok: false, error: "invalid_credentials" });
    });

    it("returns 423 on locked account", async () => {
      mockLoginWithPassword.mockResolvedValue({ ok: false, reason: "locked", lockUntilMs: 123456 });
      const res = mockRes();
      await login({ body: { email: "a@b.com", password: "test" } } as any, res);
      expect(res.status).toHaveBeenCalledWith(423);
    });

    it("returns token and user on success", async () => {
      const mockUser = { id: 1, nombre: "Test", email: "a@b.com", rol: "Vendedor" as const, empresaId: 1, empresaNombre: "Emp" }; 
      mockLoginWithPassword.mockResolvedValue({ ok: true, token: "jwt-token", user: mockUser });
      const res = mockRes();
      await login({ body: { email: "a@b.com", password: "correct" } } as any, res);
      expect(res.json).toHaveBeenCalledWith({ ok: true, token: "jwt-token", user: mockUser });
    });
  });

  describe("register", () => {
    it("returns 501 not implemented", async () => {
      const res = mockRes();
      await register({} as any, res);
      expect(res.status).toHaveBeenCalledWith(501);
      expect(res.json).toHaveBeenCalledWith({ ok: false, error: "register_not_implemented" });
    });
  });
});
