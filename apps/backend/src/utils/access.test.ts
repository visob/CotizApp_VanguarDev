import { isRole, isSuperAdmin, canManageUsers, canAssignRole } from "./access.js";

const superAdmin = { id: 1, rol: "SuperAdmin" as const, empresaId: null, nombre: "SA", email: "sa@sa.com", empresaNombre: null };
const admin = { id: 2, rol: "Admin" as const, empresaId: 1, nombre: "Admin", email: "a@a.com", empresaNombre: "Emp" };
const vendedor = { id: 3, rol: "Vendedor" as const, empresaId: 1, nombre: "V", email: "v@v.com", empresaNombre: "Emp" };

describe("access.ts", () => {
  describe("isRole", () => {
    it("recognizes SuperAdmin", () => expect(isRole("SuperAdmin")).toBe(true));
    it("recognizes Admin", () => expect(isRole("Admin")).toBe(true));
    it("recognizes Vendedor", () => expect(isRole("Vendedor")).toBe(true));
    it("rejects invalid roles", () => { expect(isRole("Supervisor")).toBe(false); expect(isRole("")).toBe(false); });
  });

  describe("isSuperAdmin", () => {
    it("returns true for SuperAdmin", () => expect(isSuperAdmin(superAdmin)).toBe(true));
    it("returns false for Admin", () => expect(isSuperAdmin(admin)).toBe(false));
    it("returns false for Vendedor", () => expect(isSuperAdmin(vendedor)).toBe(false));
    it("returns false for undefined", () => expect(isSuperAdmin(undefined)).toBe(false));
    it("returns false for null", () => expect(isSuperAdmin(null)).toBe(false));
  });

  describe("canManageUsers", () => {
    it("returns true for SuperAdmin", () => expect(canManageUsers(superAdmin)).toBe(true));
    it("returns true for Admin", () => expect(canManageUsers(admin)).toBe(true));
    it("returns false for Vendedor", () => expect(canManageUsers(vendedor)).toBe(false));
    it("returns false for undefined", () => expect(canManageUsers(undefined)).toBe(false));
    it("returns false for null", () => expect(canManageUsers(null)).toBe(false));
  });

  describe("canAssignRole", () => {
    it("SuperAdmin can assign any role", () => {
      expect(canAssignRole(superAdmin, "SuperAdmin")).toBe(true);
      expect(canAssignRole(superAdmin, "Admin")).toBe(true);
      expect(canAssignRole(superAdmin, "Vendedor")).toBe(true);
    });

    it("Admin can assign Admin or Vendedor only", () => {
      expect(canAssignRole(admin, "SuperAdmin")).toBe(false);
      expect(canAssignRole(admin, "Admin")).toBe(true);
      expect(canAssignRole(admin, "Vendedor")).toBe(true);
    });

    it("Vendedor cannot assign any role", () => {
      expect(canAssignRole(vendedor, "SuperAdmin")).toBe(false);
      expect(canAssignRole(vendedor, "Admin")).toBe(false);
      expect(canAssignRole(vendedor, "Vendedor")).toBe(false);
    });
  });
});
