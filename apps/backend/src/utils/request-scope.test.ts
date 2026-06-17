import { parseNumericId, getScopedCompanyId, getCompanyIdForWrite } from "./request-scope.js";

const mockSuperAdmin = { id: 1, rol: "SuperAdmin" as const, empresaId: null, nombre: "SA", email: "sa@sa.com", empresaNombre: null };
const mockSuperAdminWithEmp = { ...mockSuperAdmin, empresaId: 1 };
const mockAdmin = { id: 2, rol: "Admin" as const, empresaId: 5, nombre: "Admin", email: "a@a.com", empresaNombre: "Emp" };
const mockVendedor = { id: 3, rol: "Vendedor" as const, empresaId: 3, nombre: "V", email: "v@v.com", empresaNombre: "Emp" };

describe("parseNumericId", () => {
  it("parses string number", () => expect(parseNumericId("123")).toBe(123));
  it("parses number", () => expect(parseNumericId(456)).toBe(456));
  it("returns null for NaN string", () => expect(parseNumericId("abc")).toBeNull());
  it("parses empty string as 0 (Number coercion)", () => expect(parseNumericId("")).toBe(0));
  it("returns null for undefined", () => expect(parseNumericId(undefined)).toBeNull());
  it("returns null for null", () => expect(parseNumericId(null)).toBeNull());
  it("returns null for Infinity", () => expect(parseNumericId(Infinity)).toBeNull());
  it("parses negative number", () => expect(parseNumericId(-5)).toBe(-5));
  it("parses zero", () => expect(parseNumericId(0)).toBe(0));
});

describe("getScopedCompanyId", () => {
  it("returns empresaId for Admin", () => {
    const req = { user: mockAdmin, query: {} } as any;
    expect(getScopedCompanyId(req)).toBe(5);
  });

  it("returns empresaId for Vendedor", () => {
    const req = { user: mockVendedor, query: {} } as any;
    expect(getScopedCompanyId(req)).toBe(3);
  });

  it("returns id_empresa query param for SuperAdmin", () => {
    const req = { user: mockSuperAdmin, query: { id_empresa: "10" } } as any;
    expect(getScopedCompanyId(req)).toBe(10);
  });

  it("falls back to user empresaId for SuperAdmin when no query param", () => {
    const req = { user: mockSuperAdminWithEmp, query: {} } as any;
    expect(getScopedCompanyId(req)).toBe(1);
  });

  it("returns null for SuperAdmin without empresa", () => {
    const req = { user: mockSuperAdmin, query: {} } as any;
    expect(getScopedCompanyId(req)).toBeNull();
  });

  it("returns null when user is undefined", () => {
    const req = { user: undefined, query: {} } as any;
    expect(getScopedCompanyId(req)).toBeNull();
  });

  it("returns null when user is null", () => {
    const req = { user: null, query: {} } as any;
    expect(getScopedCompanyId(req)).toBeNull();
  });
});

describe("getCompanyIdForWrite", () => {
  it("returns null when no user", () => {
    const req = { user: undefined, body: {} } as any;
    expect(getCompanyIdForWrite(req)).toBeNull();
  });

  it("returns empresaId for Admin", () => {
    const req = { user: mockAdmin, body: {} } as any;
    expect(getCompanyIdForWrite(req)).toBe(5);
  });

  it("returns empresaId for Vendedor", () => {
    const req = { user: mockVendedor, body: {} } as any;
    expect(getCompanyIdForWrite(req)).toBe(3);
  });

  it("returns body id_empresa for SuperAdmin when provided", () => {
    const req = { user: mockSuperAdmin, body: { id_empresa: 99 } } as any;
    expect(getCompanyIdForWrite(req)).toBe(99);
  });

  it("falls back to user empresaId for SuperAdmin when no body", () => {
    const req = { user: mockSuperAdminWithEmp, body: {} } as any;
    expect(getCompanyIdForWrite(req)).toBe(1);
  });

  it("returns null for SuperAdmin without empresa in body or user", () => {
    const req = { user: mockSuperAdmin, body: {} } as any;
    expect(getCompanyIdForWrite(req)).toBeNull();
  });
});
