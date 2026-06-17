jest.mock("../models/config.model.js", () => ({
  listCatalogOptions: jest.fn(),
  createCatalogOption: jest.fn(),
  updateCatalogOption: jest.fn(),
  getConfig: jest.fn(),
  setConfig: jest.fn()
}));

jest.mock("../models/product.model.js", () => ({
  recalcPrecioArsForCompany: jest.fn()
}));

jest.mock("../utils/access.js", () => ({
  canManageUsers: jest.fn()
}));

jest.mock("../utils/request-scope.js", () => ({
  getScopedCompanyId: jest.fn()
}));

import * as configModel from "../models/config.model.js";
import * as productModel from "../models/product.model.js";
import * as access from "../utils/access.js";
import * as requestScope from "../utils/request-scope.js";

type MFn = jest.MockedFunction<(...args: any[]) => any>;

let configRouter: any;

beforeAll(async () => {
  const mod = await import("./config.routes.js");
  configRouter = mod.configRouter;
});

function getHandler(path: string, method: string) {
  const layer = configRouter.stack.find(
    (r: any) => r.route?.path === path && r.route?.methods?.[method]
  );
  return layer?.route?.stack?.[0]?.handle;
}

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockAdminUser() {
  return { id: 1, rol: "Admin" as const, empresaId: 1, nombre: "Admin", email: "a@a.com", empresaNombre: "Emp" };
}

describe("config.routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requestScope.getScopedCompanyId as MFn).mockReturnValue(1);
    (access.canManageUsers as MFn).mockReturnValue(true);
  });

  function withSilentConsole<T>(fn: () => Promise<T>) {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    return fn().finally(() => spy.mockRestore());
  }

  describe("GET /catalog/options", () => {
    it("returns 400 when no companyId", async () => {
      (requestScope.getScopedCompanyId as MFn).mockReturnValue(null);
      const handler = getHandler("/catalog/options", "get");
      const res = mockRes();
      await handler({ query: {} }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns catalog options with tipo filter", async () => {
      (configModel.listCatalogOptions as MFn).mockResolvedValue([{ id: "1", id_empresa: "1", tipo: "tipo_iva", label: "21%", value: "21" }]);
      const handler = getHandler("/catalog/options", "get");
      const res = mockRes();
      await handler({ query: { tipo: "tipo_iva" } }, res);
      expect(configModel.listCatalogOptions).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: "tipo_iva" })
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, items: expect.any(Array) }));
    });

    it("includes inactive options when flag is set", async () => {
      (configModel.listCatalogOptions as MFn).mockResolvedValue([]);
      const handler = getHandler("/catalog/options", "get");
      const res = mockRes();
      await handler({ query: { include_inactive: "true" } }, res);
      expect(configModel.listCatalogOptions).toHaveBeenCalledWith(
        expect.objectContaining({ includeInactive: true })
      );
    });

    it("ignores invalid tipo values", async () => {
      (configModel.listCatalogOptions as MFn).mockResolvedValue([]);
      const handler = getHandler("/catalog/options", "get");
      const res = mockRes();
      await handler({ query: { tipo: "invalid_type" } }, res);
      expect(configModel.listCatalogOptions).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: undefined })
      );
    });

    it("recalls productos when clave is exchange_rate", async () => {
      (configModel.setConfig as MFn).mockResolvedValue({ clave: "exchange_rate", valor: "1200" });
      (productModel.recalcPrecioArsForCompany as MFn).mockResolvedValue(undefined);
      const handler = getHandler("/:clave", "put");
      const res = mockRes();
      await handler({ params: { clave: "exchange_rate" }, body: { valor: "1200" } }, res);
      expect(configModel.setConfig).toHaveBeenCalledWith(1, "exchange_rate", "1200");
      expect(productModel.recalcPrecioArsForCompany).toHaveBeenCalledWith(1, 1200);
      expect(res.json).toHaveBeenCalledWith({ clave: "exchange_rate", valor: "1200" });
    });

    it("returns 400 when exchange_rate value is invalid", async () => {
      const handler = getHandler("/:clave", "put");
      const res = mockRes();
      await handler({ params: { clave: "exchange_rate" }, body: { valor: "abc" } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns 400 when exchange_rate is negative", async () => {
      const handler = getHandler("/:clave", "put");
      const res = mockRes();
      await handler({ params: { clave: "exchange_rate" }, body: { valor: "-5" } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("catches errors and returns 500", async () => {
      await withSilentConsole(async () => {
        (configModel.listCatalogOptions as MFn).mockRejectedValue(new Error("DB error"));
        const handler = getHandler("/catalog/options", "get");
        const res = mockRes();
        await handler({ query: {} }, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });

  describe("POST /catalog/options", () => {
    it("returns 403 when not admin", async () => {
      (access.canManageUsers as MFn).mockReturnValue(false);
      const handler = getHandler("/catalog/options", "post");
      const res = mockRes();
      await handler({ user: { id: 1, rol: "Vendedor" } }, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("returns 400 when empresa is missing", async () => {
      (requestScope.getScopedCompanyId as MFn).mockReturnValue(null);
      const handler = getHandler("/catalog/options", "post");
      const res = mockRes();
      await handler({ user: mockAdminUser(), body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns 400 when required fields missing", async () => {
      const handler = getHandler("/catalog/options", "post");
      const res = mockRes();
      await handler({ user: mockAdminUser(), body: {} }, res);
      expect(res.json).toHaveBeenCalledWith({ error: "invalid_request" });
    });

    it("creates catalog option and returns 201", async () => {
      (configModel.createCatalogOption as MFn).mockResolvedValue({
        id: "10", id_empresa: "1", tipo: "tipo_iva", label: "21%", value: "21"
      });
      const handler = getHandler("/catalog/options", "post");
      const res = mockRes();
      await handler({ user: mockAdminUser(), body: { tipo: "tipo_iva", label: "21%", value: "21" } }, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });

    it("uses label as value when value not provided", async () => {
      (configModel.createCatalogOption as MFn).mockResolvedValue({
        id: "11", id_empresa: "1", tipo: "forma_pago", label: "Transferencia", value: "Transferencia"
      });
      const handler = getHandler("/catalog/options", "post");
      const res = mockRes();
      await handler({ user: mockAdminUser(), body: { tipo: "forma_pago", label: "Transferencia" } }, res);
      expect(configModel.createCatalogOption).toHaveBeenCalledWith(
        expect.objectContaining({ value: "Transferencia" })
      );
    });

    it("catches errors and returns 500", async () => {
      await withSilentConsole(async () => {
        (configModel.createCatalogOption as MFn).mockRejectedValue(new Error("DB error"));
        const handler = getHandler("/catalog/options", "post");
        const res = mockRes();
        await handler({ user: mockAdminUser(), body: { tipo: "tipo_iva", label: "21%", value: "21" } }, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });

  describe("PUT /catalog/options/:id", () => {
    it("returns 403 when not admin", async () => {
      (access.canManageUsers as MFn).mockReturnValue(false);
      const handler = getHandler("/catalog/options/:id", "put");
      const res = mockRes();
      await handler({ user: { id: 1, rol: "Vendedor" }, params: { id: "1" }, body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("returns 400 for invalid id", async () => {
      const handler = getHandler("/catalog/options/:id", "put");
      const res = mockRes();
      await handler({ user: mockAdminUser(), params: { id: "abc" }, body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns 400 when label explicitly cleared", async () => {
      const handler = getHandler("/catalog/options/:id", "put");
      const res = mockRes();
      await handler({ user: mockAdminUser(), params: { id: "1" }, body: { label: "" } }, res);
      expect(res.json).toHaveBeenCalledWith({ error: "label_required" });
    });

    it("returns 400 when value explicitly cleared", async () => {
      const handler = getHandler("/catalog/options/:id", "put");
      const res = mockRes();
      await handler({ user: mockAdminUser(), params: { id: "1" }, body: { value: "" } }, res);
      expect(res.json).toHaveBeenCalledWith({ error: "value_required" });
    });

    it("returns 404 when option not found", async () => {
      (configModel.updateCatalogOption as MFn).mockResolvedValue(null);
      const handler = getHandler("/catalog/options/:id", "put");
      const res = mockRes();
      await handler({ user: mockAdminUser(), params: { id: "99" }, body: { label: "Updated" } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("updates option successfully", async () => {
      (configModel.updateCatalogOption as MFn).mockResolvedValue({
        id: "1", id_empresa: "1", tipo: "tipo_iva", label: "Updated", value: "22", activo: true
      });
      const handler = getHandler("/catalog/options/:id", "put");
      const res = mockRes();
      await handler({ user: mockAdminUser(), params: { id: "1" }, body: { label: "Updated", value: "22", activo: true } }, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });

    it("catches errors and returns 500", async () => {
      await withSilentConsole(async () => {
        (configModel.updateCatalogOption as MFn).mockRejectedValue(new Error("DB error"));
        const handler = getHandler("/catalog/options/:id", "put");
        const res = mockRes();
        await handler({ user: mockAdminUser(), params: { id: "1" }, body: { label: "X" } }, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });

  describe("PATCH /catalog/options/:id/deactivate", () => {
    it("returns 400 for invalid id", async () => {
      const handler = getHandler("/catalog/options/:id/deactivate", "patch");
      const res = mockRes();
      await handler({ user: mockAdminUser(), params: { id: "x" } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns 404 when option not found", async () => {
      (configModel.updateCatalogOption as MFn).mockResolvedValue(null);
      const handler = getHandler("/catalog/options/:id/deactivate", "patch");
      const res = mockRes();
      await handler({ user: mockAdminUser(), params: { id: "99" } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("deactivates option successfully", async () => {
      (configModel.updateCatalogOption as MFn).mockResolvedValue({
        id: "1", id_empresa: "1", tipo: "tipo_iva", label: "21%", value: "21", activo: false
      });
      const handler = getHandler("/catalog/options/:id/deactivate", "patch");
      const res = mockRes();
      await handler({ user: mockAdminUser(), params: { id: "1" } }, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });
  });

  describe("PATCH /catalog/options/:id/activate", () => {
    it("activates option successfully", async () => {
      (configModel.updateCatalogOption as MFn).mockResolvedValue({
        id: "1", id_empresa: "1", tipo: "tipo_iva", label: "21%", value: "21", activo: true
      });
      const handler = getHandler("/catalog/options/:id/activate", "patch");
      const res = mockRes();
      await handler({ user: mockAdminUser(), params: { id: "1" } }, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });
  });

  describe("GET /:clave", () => {
    it("returns 400 when no companyId", async () => {
      (requestScope.getScopedCompanyId as MFn).mockReturnValue(null);
      const handler = getHandler("/:clave", "get");
      const res = mockRes();
      await handler({ params: { clave: "theme" } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns 404 when config not found", async () => {
      (configModel.getConfig as MFn).mockResolvedValue(null);
      const handler = getHandler("/:clave", "get");
      const res = mockRes();
      await handler({ params: { clave: "theme" } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("returns config value when found", async () => {
      (configModel.getConfig as MFn).mockResolvedValue({ clave: "theme", valor: "dark" });
      const handler = getHandler("/:clave", "get");
      const res = mockRes();
      await handler({ params: { clave: "theme" } }, res);
      expect(res.json).toHaveBeenCalledWith({ clave: "theme", valor: "dark" });
    });
  });

  describe("PUT /:clave", () => {
    it("returns 400 when no valor", async () => {
      const handler = getHandler("/:clave", "put");
      const res = mockRes();
      await handler({ params: { clave: "theme" }, body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("sets config successfully", async () => {
      (configModel.setConfig as MFn).mockResolvedValue({ clave: "theme", valor: "light" });
      const handler = getHandler("/:clave", "put");
      const res = mockRes();
      await handler({ params: { clave: "theme" }, body: { valor: "light" } }, res);
      expect(res.json).toHaveBeenCalledWith({ clave: "theme", valor: "light" });
    });

    it("catches errors and returns 500", async () => {
      await withSilentConsole(async () => {
        (configModel.setConfig as MFn).mockRejectedValue(new Error("DB error"));
        const handler = getHandler("/:clave", "put");
        const res = mockRes();
        await handler({ params: { clave: "theme" }, body: { valor: "dark" } }, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });
});
