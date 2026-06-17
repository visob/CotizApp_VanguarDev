jest.mock("../config/database.js", () => ({
  pool: {
    query: jest.fn()
  }
}));

import { pool } from "../config/database.js";

import {
  listProducts,
  getProductById,
  createProduct,
  findDuplicateProduct,
  updateProduct,
  deleteProduct
} from "./product.model.js";

type MFn = jest.MockedFunction<(...args: any[]) => any>;
const mockQuery = pool.query as unknown as MFn;

function rows<T>(data: T[]) {
  return { rows: data };
}

const sampleProduct = {
  id: "1", nombre: "Product A", tipo_producto: "Hardware",
  precio_ars: "1000.00", precio_usd: "1.00", sku: "SKU-001",
  descripcion: null, estado: "Activo", garantia: "12 meses"
};

const sampleInput = {
  nombre: "Product A", tipo_producto: "Hardware",
  precio_ars: "1000.00", precio_usd: "1.00", sku: "SKU-001",
  descripcion: null, estado: "Activo", garantia: "12 meses"
};

describe("product.model", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("listProducts", () => {
    it("returns rows without company filter", async () => {
      mockQuery.mockResolvedValue(rows([sampleProduct]));
      const result = await listProducts();
      expect(result).toEqual([sampleProduct]);
    });

    it("returns rows filtered by companyId", async () => {
      mockQuery.mockResolvedValue(rows([]));
      await listProducts(5);
      expect(mockQuery.mock.calls[0][0]).toContain("where id_empresa = $1");
    });
  });

  describe("getProductById", () => {
    it("returns product when found", async () => {
      mockQuery.mockResolvedValue(rows([sampleProduct]));
      expect(await getProductById(1, 5)).toEqual(sampleProduct);
    });

    it("returns null when not found", async () => {
      mockQuery.mockResolvedValue(rows([]));
      expect(await getProductById(999)).toBeNull();
    });
  });

  describe("createProduct", () => {
    it("inserts and returns product", async () => {
      mockQuery.mockResolvedValue(rows([sampleProduct]));
      const result = await createProduct(1, sampleInput);
      expect(result).toEqual(sampleProduct);
    });

    it("defaults estado to Activo when empty", async () => {
      mockQuery.mockResolvedValue(rows([{ ...sampleProduct, estado: "Activo" }]));
      await createProduct(1, { ...sampleInput, estado: "" });
      expect(mockQuery.mock.calls[0][1][7]).toBe("Activo");
    });
  });

  describe("findDuplicateProduct", () => {
    it("returns null when no duplicates", async () => {
      mockQuery.mockResolvedValueOnce(rows([]));
      mockQuery.mockResolvedValueOnce(rows([]));
      expect(await findDuplicateProduct(1, { nombre: "Unique", sku: "SKU-999" })).toBeNull();
    });

    it("returns duplicate_nombre when name matches", async () => {
      mockQuery.mockResolvedValueOnce(rows([{ id: "5" }]));
      expect(await findDuplicateProduct(1, { nombre: "Prod", sku: "X" })).toBe("duplicate_nombre");
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it("returns duplicate_sku when SKU matches", async () => {
      mockQuery.mockResolvedValueOnce(rows([]));
      mockQuery.mockResolvedValueOnce(rows([{ id: "7" }]));
      expect(await findDuplicateProduct(1, { nombre: "Unique", sku: "SKU-001" })).toBe("duplicate_sku");
    });

    it("returns null when SKU is null and name does not match", async () => {
      mockQuery.mockResolvedValueOnce(rows([]));
      expect(await findDuplicateProduct(1, { nombre: "Unique", sku: null })).toBeNull();
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it("excludes provided id when updating", async () => {
      mockQuery.mockResolvedValueOnce(rows([]));
      mockQuery.mockResolvedValueOnce(rows([]));
      await findDuplicateProduct(1, { nombre: "X", sku: "Y" }, 10);
      expect(mockQuery.mock.calls[0][0]).toContain("and id <>");
    });
  });

  describe("updateProduct", () => {
    it("updates and returns product", async () => {
      mockQuery.mockResolvedValue(rows([{ ...sampleProduct, nombre: "Updated" }]));
      const result = await updateProduct(1, sampleInput, 5);
      expect(result?.nombre).toBe("Updated");
      expect(mockQuery.mock.calls[0][0]).toContain("update productos");
    });

    it("returns null when no match", async () => {
      mockQuery.mockResolvedValue(rows([]));
      expect(await updateProduct(999, sampleInput)).toBeNull();
    });
  });

  describe("deleteProduct", () => {
    it("returns true on deletion", async () => {
      mockQuery.mockResolvedValue(rows([{ id: "1" }]));
      expect(await deleteProduct(1, 5)).toBe(true);
    });

    it("returns false when not found", async () => {
      mockQuery.mockResolvedValue(rows([]));
      expect(await deleteProduct(999)).toBe(false);
    });
  });
});
