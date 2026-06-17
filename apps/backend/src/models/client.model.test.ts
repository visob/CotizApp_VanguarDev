jest.mock("../config/database.js", () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn()
  }
}));

import { pool } from "../config/database.js";

import {
  listClients,
  getClientById,
  createClient,
  findDuplicateClient,
  updateClient,
  deleteClient,
  listClientContacts,
  listClientQuotes,
  listClientReactivations,
  createClientContact
} from "./client.model.js";

type MFn = jest.MockedFunction<(...args: any[]) => any>;
const mockQuery = pool.query as unknown as MFn;
const mockConnect = pool.connect as unknown as MFn;

function rows<T>(data: T[]) {
  return { rows: data };
}

const sampleClient = {
  id: "1", nombre_empresa: "Test SA", contacto_principal: "Juan",
  cuit_tax_id: "30-12345678", clasificacion: null, email: null,
  telefono: null, direccion: null, codigo_postal: null, pais: null,
  provincia: null, estado: "Activo", ult_contacto: null
};

const sampleInput = {
  nombre_empresa: "Test SA", contacto_principal: null, cuit_tax_id: "30-12345678",
  clasificacion: null, email: null, telefono: null, direccion: null,
  codigo_postal: null, pais: null, provincia: null, estado: "Activo", ult_contacto: null
};

describe("client.model", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("listClients", () => {
    it("returns rows without company filter", async () => {
      mockQuery.mockResolvedValue(rows([sampleClient]));
      const result = await listClients();
      expect(result).toEqual([sampleClient]);
      expect(mockQuery.mock.calls[0][0]).not.toContain("where");
    });

    it("returns rows filtered by companyId", async () => {
      mockQuery.mockResolvedValue(rows([]));
      await listClients(5);
      expect(mockQuery.mock.calls[0][0]).toContain("where id_empresa = $1");
      expect(mockQuery.mock.calls[0][1]).toEqual([5]);
    });

    it("returns empty array when no rows", async () => {
      mockQuery.mockResolvedValue(rows([]));
      const result = await listClients();
      expect(result).toEqual([]);
    });
  });

  describe("getClientById", () => {
    it("returns client when found", async () => {
      mockQuery.mockResolvedValue(rows([sampleClient]));
      const result = await getClientById(1, 5);
      expect(result).toEqual(sampleClient);
    });

    it("returns null when not found", async () => {
      mockQuery.mockResolvedValue(rows([]));
      const result = await getClientById(999);
      expect(result).toBeNull();
    });
  });

  describe("createClient", () => {
    it("inserts and returns client", async () => {
      mockQuery.mockResolvedValue(rows([sampleClient]));
      const result = await createClient(1, sampleInput);
      expect(result).toEqual(sampleClient);
      expect(mockQuery.mock.calls[0][0]).toContain("insert into clientes");
    });
  });

  describe("findDuplicateClient", () => {
    it("returns null when no duplicates", async () => {
      mockQuery.mockResolvedValueOnce(rows([]));
      mockQuery.mockResolvedValueOnce(rows([]));
      const result = await findDuplicateClient(1, { nombre_empresa: "Unique", cuit_tax_id: "99-999" });
      expect(result).toBeNull();
    });

    it("returns duplicate_nombre_empresa when name matches", async () => {
      mockQuery.mockResolvedValueOnce(rows([{ id: "5" }]));
      const result = await findDuplicateClient(1, { nombre_empresa: "Test SA", cuit_tax_id: "30-123" });
      expect(result).toBe("duplicate_nombre_empresa");
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it("returns duplicate_cuit_tax_id when CUIT matches", async () => {
      mockQuery.mockResolvedValueOnce(rows([]));
      mockQuery.mockResolvedValueOnce(rows([{ id: "7" }]));
      const result = await findDuplicateClient(1, { nombre_empresa: "Unique", cuit_tax_id: "30-12345678" });
      expect(result).toBe("duplicate_cuit_tax_id");
    });

    it("returns null when CUIT is null and name does not match", async () => {
      mockQuery.mockResolvedValueOnce(rows([]));
      const result = await findDuplicateClient(1, { nombre_empresa: "Unique", cuit_tax_id: null });
      expect(result).toBeNull();
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it("excludes provided id when updating", async () => {
      mockQuery.mockResolvedValueOnce(rows([]));
      mockQuery.mockResolvedValueOnce(rows([]));
      await findDuplicateClient(1, { nombre_empresa: "X", cuit_tax_id: "Y" }, 10);
      expect(mockQuery.mock.calls[0][0]).toContain("and id <> $");
    });
  });

  describe("updateClient", () => {
    it("updates and returns client", async () => {
      mockQuery.mockResolvedValue(rows([{ ...sampleClient, nombre_empresa: "Updated" }]));
      const result = await updateClient(1, sampleInput, 5);
      expect(result?.nombre_empresa).toBe("Updated");
      expect(mockQuery.mock.calls[0][0]).toContain("update clientes");
    });

    it("returns null when no match", async () => {
      mockQuery.mockResolvedValue(rows([]));
      const result = await updateClient(999, sampleInput);
      expect(result).toBeNull();
    });
  });

  describe("deleteClient", () => {
    it("returns true on deletion", async () => {
      mockQuery.mockResolvedValue(rows([{ id: "1" }]));
      const result = await deleteClient(1, 5);
      expect(result).toBe(true);
    });

    it("returns false when not found", async () => {
      mockQuery.mockResolvedValue(rows([]));
      const result = await deleteClient(999);
      expect(result).toBe(false);
    });
  });

  describe("listClientContacts", () => {
    it("returns contacts list", async () => {
      const contact = { id: "1", id_empresa: "1", id_cliente: "1", id_usuario: "1", fecha_carga: "2024", fecha_contacto: "2024", observacion: null, usuario_nombre: "Test" };
      mockQuery.mockResolvedValue(rows([contact]));
      const result = await listClientContacts(1, 5);
      expect(result).toHaveLength(1);
      expect(mockQuery.mock.calls[0][0]).toContain("cliente_contactos");
    });
  });

  describe("listClientQuotes", () => {
    it("returns quotes with activeReactivationSql", async () => {
      mockQuery.mockResolvedValue(rows([]));
      const result = await listClientQuotes(1);
      expect(result).toEqual([]);
      expect(mockQuery.mock.calls[0][0]).toContain("coalesce");
    });
  });

  describe("listClientReactivations", () => {
    it("returns reactivations with filters", async () => {
      mockQuery.mockResolvedValue(rows([]));
      const result = await listClientReactivations(1, 5);
      expect(result).toEqual([]);
      expect(mockQuery.mock.calls[0][0]).toContain("CERRADA_GANADA");
      expect(mockQuery.mock.calls[0][0]).toContain("is not null");
    });
  });

  describe("createClientContact", () => {

    it("rolls back and returns null when client not found", async () => {
      const dbClient = { query: jest.fn(), release: jest.fn() };
      mockConnect.mockResolvedValue(dbClient);
      dbClient.query.mockResolvedValue({ rows: [] });
      const result = await createClientContact({ companyId: 1, clientId: 999, userId: 1, fechaContacto: "2024-01-01T00:00:00Z", observacion: null });
      expect(result).toBeNull();
      expect(dbClient.query).toHaveBeenCalledWith("rollback");
      expect(dbClient.release).toHaveBeenCalled();
    });

    it("creates contact and updates ult_contacto", async () => {
      const contactRow = { id: "10", id_empresa: "1", id_cliente: "1", id_usuario: "1", fecha_carga: "2024", fecha_contacto: "2024", observacion: null, usuario_nombre: "Test" };
      const dbClient = { query: jest.fn(), release: jest.fn() };
      mockConnect.mockResolvedValue(dbClient);
      dbClient.query.mockResolvedValue({ rows: [contactRow] });

      const result = await createClientContact({ companyId: 1, clientId: 1, userId: 1, fechaContacto: "2024-01-01T00:00:00Z", observacion: "Note" });
      expect(result).toEqual(contactRow);
      expect(dbClient.query).toHaveBeenCalledWith("begin");
      expect(dbClient.query).toHaveBeenCalledWith("commit");
      expect(dbClient.release).toHaveBeenCalled();
    });

    it("rolls back and throws on error", async () => {
      const dbClient = { query: jest.fn(), release: jest.fn() };
      mockConnect.mockResolvedValue(dbClient);
      dbClient.query.mockResolvedValue({ rows: [{ id: "1" }] });
      dbClient.query.mockImplementationOnce(() => { throw new Error("DB down"); });

      await expect(createClientContact({ companyId: 1, clientId: 1, userId: 1, fechaContacto: "2024", observacion: null }))
        .rejects.toThrow("DB down");
      expect(dbClient.query).toHaveBeenCalledWith("rollback");
      expect(dbClient.release).toHaveBeenCalled();
    });
  });
});
