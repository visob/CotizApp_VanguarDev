import {
  buildCompanyLogoPublicPath,
  removeStoredFile
} from "./file-storage.js";

import fs from "node:fs";

jest.mock("node:fs");

type MFn = jest.Mock;
const mockFs = fs as any;

describe("file-storage.ts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("buildCompanyLogoPublicPath", () => {
    it("builds public path from filename", () => {
      expect(buildCompanyLogoPublicPath("logo.jpg")).toBe("/uploads/company-logos/logo.jpg");
    });

    it("handles UUID filenames", () => {
      expect(buildCompanyLogoPublicPath("abc-123.png")).toBe("/uploads/company-logos/abc-123.png");
    });
  });

  describe("removeStoredFile", () => {
    it("returns early for null", () => {
      removeStoredFile(null);
      expect(fs.existsSync).not.toHaveBeenCalled();
    });

    it("returns early for undefined", () => {
      removeStoredFile(undefined);
      expect(fs.existsSync).not.toHaveBeenCalled();
    });

    it("returns early for non-/uploads/ path", () => {
      removeStoredFile("/tmp/file.jpg");
      expect(fs.existsSync).not.toHaveBeenCalled();
    });

    it("skips paths with backslash traversal outside uploads", () => {
      removeStoredFile("/uploads/..\\..\\etc\\passwd");
      expect(fs.existsSync).not.toHaveBeenCalled();
    });

    it("deletes existing file", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.mkdirSync.mockReturnValue(undefined);
      removeStoredFile("/uploads/company-logos/toast.jpg");
      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it("does nothing when file does not exist", () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockReturnValue(undefined);
      removeStoredFile("/uploads/company-logos/ghost.jpg");
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it("catches errors gracefully (best effort cleanup)", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.mkdirSync.mockReturnValue(undefined);
      mockFs.unlinkSync.mockImplementation(() => { throw new Error("permission"); });
      expect(() => removeStoredFile("/uploads/company-logos/locked.jpg")).not.toThrow();
    });
  });
});
