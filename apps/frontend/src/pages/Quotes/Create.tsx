import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useBeforeUnload, useNavigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "../../components/common/Button";
import { useToast } from "../../context/ToastContext";
import { ReturnIcon, TrashIcon } from "../../components/common/Icons";
import type { CatalogOption, Client, CurrencyCode, Product } from "../../types";
import * as clientService from "../../services/client.service";
import * as configService from "../../services/config.service";
import * as productService from "../../services/product.service";
import * as quoteService from "../../services/quote.service";
import { extractIsoDate } from "../../utils/date";
import { getErrorMessage } from "../../utils/feedback";
import "../../styles/quotes.css"; // assuming there's quotes.css, or just keep layout.css if it's there

type QuoteItemDraft = {
  id_producto: string;
  product_query: string;
  product_search_open: boolean;
  product_active_index: number;
  cantidad: string;
  iva_porcentaje: string;
};

function parseMoneyToCents(value: unknown) {
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
  const normalized = raw.replace(",", ".").trim();
  if (!normalized) return null;

  const match = normalized.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;

  const whole = match[1] ?? "0";
  const frac = (match[2] ?? "").padEnd(2, "0");

  const cents = BigInt(whole) * 100n + BigInt(frac || "0");
  return cents >= 0n ? cents : null;
}

function centsToMoneyString(cents: bigint) {
  const sign = cents < 0n ? "-" : "";
  const abs = cents < 0n ? -cents : cents;
  const whole = abs / 100n;
  const frac = abs % 100n;
  return `${sign}${whole.toString()}.${frac.toString().padStart(2, "0")}`;
}

function parsePercentToBasisPoints(value: unknown) {
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
  const normalized = raw.replace(",", ".").trim();
  if (!normalized) return null;

  const match = normalized.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;

  const whole = match[1] ?? "0";
  const frac = (match[2] ?? "").padEnd(2, "0");
  const bp = BigInt(whole) * 100n + BigInt(frac || "0");
  return bp >= 0n ? bp : null;
}

function calcIvaCents(subtotalCents: bigint, ivaBasisPoints: bigint) {
  const numerator = subtotalCents * ivaBasisPoints;
  return (numerator + 5000n) / 10000n;
}

function parseQty(value: string) {
  const n = Number(value.trim());
  if (!Number.isFinite(n)) return null;
  const int = Math.trunc(n);
  return int > 0 ? int : null;
}

function normalizePercentInput(value: string) {
  return value.replaceAll("%", "").trim();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function formatDateInput(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateInputValue(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  return Number.isFinite(date.getTime()) ? date : null;
}

function isActiveRecord(status: string | null | undefined) {
  return (status ?? "").trim().toLocaleLowerCase("es-AR") === "activo";
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function buildQuoteDraftSignature(input: {
  idCliente: string;
  clientQuery: string;
  estado: string;
  moneda: CurrencyCode;
  fechaCotizacion: string;
  fechaVencimiento: string;
  fechaReactivacion1: string;
  fechaReactivacion2: string;
  fechaReactivacion3: string;
  reactivacionActiva: 1 | 2 | 3;
  items: QuoteItemDraft[];
  notas: string;
  plazoEntrega: string;
  formaPago: string;
  lugarEntrega: string;
  descuentoPorcentajeGlobal: string;
}) {
  return JSON.stringify({
    idCliente: input.idCliente,
    clientQuery: input.clientQuery,
    estado: input.estado,
    moneda: input.moneda,
    fechaCotizacion: input.fechaCotizacion,
    fechaVencimiento: input.fechaVencimiento,
    fechaReactivacion1: input.fechaReactivacion1,
    fechaReactivacion2: input.fechaReactivacion2,
    fechaReactivacion3: input.fechaReactivacion3,
    reactivacionActiva: input.reactivacionActiva,
    items: input.items.map((item) => ({
      id_producto: item.id_producto,
      product_query: item.product_query,
      cantidad: item.cantidad,
      iva_porcentaje: item.iva_porcentaje
    })),
    notas: input.notas,
    plazoEntrega: input.plazoEntrega,
    formaPago: input.formaPago,
    lugarEntrega: input.lugarEntrega,
    descuentoPorcentajeGlobal: input.descuentoPorcentajeGlobal
  });
}

export default function QuotesCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const editIdRaw = searchParams.get("editId");
  const editQuoteId = editIdRaw ? Number(editIdRaw) : null;
  const isEditMode = editQuoteId !== null && Number.isFinite(editQuoteId) && editQuoteId > 0;
  const defaultExitPath = isEditMode ? `/quotes/${editQuoteId}` : "/quotes";

  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogOptions, setCatalogOptions] = useState<CatalogOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [allowNavigation, setAllowNavigation] = useState(false);
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [initialFormSignature, setInitialFormSignature] = useState<string | null>(null);

  const [idCliente, setIdCliente] = useState<string>(() => searchParams.get("clientId") ?? "");
  const [clientQuery, setClientQuery] = useState("");
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [activeClientIndex, setActiveClientIndex] = useState(-1);
  const [estado, setEstado] = useState<string>("BORRADOR");
  const [moneda, setMoneda] = useState<CurrencyCode>("ARS");
  const [fechaCotizacion, setFechaCotizacion] = useState<string>(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [fechaVencimiento, setFechaVencimiento] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return formatDateInput(d);
  });
  const [fechaReactivacion1, setFechaReactivacion1] = useState<string>(() => formatDateInput(addDays(new Date(), 7)));
  const [fechaReactivacion2, setFechaReactivacion2] = useState<string>(() => formatDateInput(addDays(new Date(), 14)));
  const [fechaReactivacion3, setFechaReactivacion3] = useState<string>(() => formatDateInput(addDays(new Date(), 21)));
  const [reactivacionActiva, setReactivacionActiva] = useState<1 | 2 | 3>(1);

  const [items, setItems] = useState<QuoteItemDraft[]>([
    { id_producto: "", product_query: "", product_search_open: false, product_active_index: -1, cantidad: "1", iva_porcentaje: "" }
  ]);

  const [notas, setNotas] = useState("");
  const [plazoEntrega, setPlazoEntrega] = useState("");
  const [formaPago, setFormaPago] = useState("");
  const [lugarEntrega, setLugarEntrega] = useState("");
  const [descuentoPorcentajeGlobal, setDescuentoPorcentajeGlobal] = useState("0");
  const [exchangeRate, setExchangeRate] = useState("1000");

  const quoteErrorMessages: Record<string, string> = {
    cliente_invalido: "Seleccioná un cliente válido.",
    cliente_inactivo: "El cliente seleccionado no está activo.",
    producto_invalido: "Uno de los productos seleccionados no es válido.",
    producto_inactivo: "Uno de los productos seleccionados no está activo.",
    items_requeridos: "Agregá al menos un producto con cantidad válida.",
    solo_borrador_editable: "Solo podés editar cotizaciones en estado borrador.",
    tipo_iva_requerido: "Todos los productos deben tener un tipo de IVA válido.",
    tipo_iva_invalido: "Uno de los tipos de IVA seleccionados no es válido.",
    precio_producto_invalido: "Uno de los productos seleccionados no tiene un precio válido."
  };

  async function reloadCatalog() {
    setLoading(true);
    setError(null);
    try {
      const [c, p, options] = await Promise.all([
        clientService.listClients(),
        productService.listProducts(),
        configService.listCatalogOptions()
      ]);
      setClients(c);
      setProducts(p);
      setCatalogOptions(options);
    } catch (err) {
      setError(err instanceof Error ? err.message : "load_error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reloadCatalog();
  }, []);

  useEffect(() => {
    async function fetchRate() {
      const rateConfig = await configService.getConfig("exchange_rate");
      if (rateConfig) {
        const rate = parseFloat(rateConfig.valor);
        if (!isNaN(rate) && rate > 0) {
          setExchangeRate(rateConfig.valor);
        }
      }
    }
    void fetchRate();
  }, []);

  useEffect(() => {
    if (!isEditMode || editQuoteId === null) return;
    const quoteId = editQuoteId;
    setDraftLoading(true);
    setError(null);
    setInfo(null);
    setInitialFormSignature(null);
    setClientSearchOpen(false);
    setActiveClientIndex(-1);
    setExitModalOpen(false);
    setPendingPath(null);

    async function loadDraft() {
      const result = await quoteService.getQuote(quoteId);
      const q = result.quote;
      if (q.estado !== "BORRADOR") {
        showToast({ type: "error", text: "Solo podés editar cotizaciones en estado borrador." });
        navigate(`/quotes/${quoteId}`);
        return;
      }

      setIdCliente(String(q.id_cliente));
      setClientQuery(result.client?.nombre_empresa ?? "");
      setEstado("BORRADOR");
      setMoneda(q.moneda);
      setFechaCotizacion(extractIsoDate(q.fecha_emision) ?? formatDateInput(new Date()));
      setFechaVencimiento(extractIsoDate(q.fecha_vencimiento) ?? "");
      setFechaReactivacion1(extractIsoDate(q.fecha_reactivacion_1) ?? "");
      setFechaReactivacion2(extractIsoDate(q.fecha_reactivacion_2) ?? "");
      setFechaReactivacion3(extractIsoDate(q.fecha_reactivacion_3) ?? "");
      setReactivacionActiva((Number(q.reactivacion_activa ?? 1) as 1 | 2 | 3) ?? 1);
      setDescuentoPorcentajeGlobal(q.descuento_porcentaje_global ?? "0");
      setNotas(q.notas ?? "");
      setPlazoEntrega(q.plazo_entrega ?? "");
      setFormaPago(q.forma_pago ?? "");
      setLugarEntrega(q.lugar_entrega ?? "");

      const nextItems =
        result.items.length > 0
          ? result.items.map((item) => ({
              id_producto: String(item.id_producto),
              product_query: item.producto_nombre ?? "",
              product_search_open: false,
              product_active_index: -1,
              cantidad: String(item.cantidad ?? 1),
              iva_porcentaje: item.iva_porcentaje ?? ""
            }))
          : [
              {
                id_producto: "",
                product_query: "",
                product_search_open: false,
                product_active_index: -1,
                cantidad: "1",
                iva_porcentaje: ""
              }
            ];
      setItems(nextItems);
    }

    loadDraft()
      .catch((err) => {
        setError(getErrorMessage(err, {}, "No se pudo cargar el borrador"));
      })
      .finally(() => setDraftLoading(false));
  }, [editQuoteId, isEditMode, navigate, showToast]);

  function normalizeSearchText(value: string) {
    return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("es-AR");
  }

  const sortedClients = useMemo(
    () =>
      [...clients]
        .filter((client) => isActiveRecord(client.estado))
        .sort((a, b) => a.nombre_empresa.localeCompare(b.nombre_empresa, "es-AR")),
    [clients]
  );

  const filteredClients = useMemo(() => {
    const query = normalizeSearchText(clientQuery);
    if (!query) {
      return sortedClients.slice(0, 12);
    }

    return sortedClients
      .filter((client) => normalizeSearchText(client.nombre_empresa).includes(query))
      .slice(0, 12);
  }, [clientQuery, sortedClients]);

  const sortedProducts = useMemo(
    () =>
      [...products]
        .filter((product) => isActiveRecord(product.estado))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es-AR")),
    [products]
  );

  function getFilteredProducts(query: string) {
    const normalized = normalizeSearchText(query);
    if (!query) {
      return sortedProducts.slice(0, 12);
    }

    return sortedProducts
      .filter((product) => normalizeSearchText(product.nombre).includes(normalized))
      .slice(0, 12);
  }

  useEffect(() => {
    if (filteredClients.length === 0) {
      setActiveClientIndex(-1);
      return;
    }

    setActiveClientIndex((current) => {
      if (current < 0) return 0;
      if (current >= filteredClients.length) return filteredClients.length - 1;
      return current;
    });
  }, [filteredClients]);

  useEffect(() => {
    if (!idCliente) return;
    const selectedClient = clients.find((client) => String(client.id) === idCliente);
    if (selectedClient) {
      setClientQuery(selectedClient.nombre_empresa);
    }
  }, [idCliente, clients]);

  const formaPagoOptions = useMemo(
    () => catalogOptions.filter((option) => option.tipo === "forma_pago" && option.activo),
    [catalogOptions]
  );
  const lugarEntregaOptions = useMemo(
    () => catalogOptions.filter((option) => option.tipo === "lugar_entrega" && option.activo),
    [catalogOptions]
  );
  const ivaOptions = useMemo(
    () => catalogOptions.filter((option) => option.tipo === "tipo_iva" && option.activo),
    [catalogOptions]
  );

  useEffect(() => {
    if (ivaOptions.length === 0) return;
    const defaultIva = ivaOptions[0]?.value ?? "";
    setItems((prev) =>
      prev.map((item) =>
        item.iva_porcentaje
          ? item
          : {
              ...item,
              iva_porcentaje: defaultIva
            }
      )
    );
  }, [ivaOptions]);

  const preview = useMemo(() => {
    const globalDiscountBp =
      parsePercentToBasisPoints(normalizePercentInput(descuentoPorcentajeGlobal)) ?? 0n;
    const lines = items
      .map((it, idx) => {
        const id = Number(it.id_producto);
        const product = products.find((p) => p.id === id);
        if (!product) {
          return {
            idx,
            productName: "Seleccionar",
            unitCents: 0n,
            qty: null as number | null,
            ivaBp: parsePercentToBasisPoints(it.iva_porcentaje) ?? 0n,
            netLineCents: null as bigint | null
          };
        }

        const qty = parseQty(it.cantidad);
        const unitStr = moneda === "ARS" ? product.precio_ars : product.precio_usd;
        const unitCents = parseMoneyToCents(unitStr) ?? 0n;

        if (!qty) {
          return {
            idx,
            productName: product.nombre,
            unitCents,
            qty,
            ivaBp: parsePercentToBasisPoints(it.iva_porcentaje) ?? 0n,
            netLineCents: null
          };
        }

        const gross = unitCents * BigInt(qty);
        const discountLine = (gross * globalDiscountBp + 5000n) / 10000n;
        const net = gross > discountLine ? gross - discountLine : 0n;

        return {
          idx,
          productName: product.nombre,
          unitCents,
          qty,
          ivaBp: parsePercentToBasisPoints(it.iva_porcentaje) ?? 0n,
          netLineCents: net
        };
      })
      .filter(Boolean);

    const subtotalSinImpuestosCents = lines.reduce((acc, l) => acc + (l.netLineCents ?? 0n), 0n);
    const descuentoCents = lines.reduce((acc, line) => {
      const gross = line.qty ? line.unitCents * BigInt(line.qty) : 0n;
      const d = (gross * globalDiscountBp + 5000n) / 10000n;
      return acc + d;
    }, 0n);
    const subtotalAntesDescuentoCents =
      subtotalSinImpuestosCents + descuentoCents;
    const impuestosCents = lines.reduce(
      (acc, line) => acc + calcIvaCents(line.netLineCents ?? 0n, line.ivaBp ?? 0n),
      0n
    );
    const subtotalConImpuestosCents = subtotalSinImpuestosCents + impuestosCents;

    return {
      lines,
      subtotalAntesDescuentoCents,
      subtotalSinImpuestosCents,
      descuentoCents,
      impuestosCents,
      subtotalConImpuestosCents
    };
  }, [items, products, moneda, descuentoPorcentajeGlobal]);

  const discountBpInput = useMemo(
    () => parsePercentToBasisPoints(normalizePercentInput(descuentoPorcentajeGlobal)),
    [descuentoPorcentajeGlobal]
  );
  const isDiscountValid = discountBpInput !== null && discountBpInput >= 0n && discountBpInput <= 10000n;
  const moneyPrefix = moneda === "USD" ? "USD " : "$";

  function formatSelectedMoney(cents: bigint) {
    return `${moneyPrefix}${centsToMoneyString(cents)}`;
  }

  function getReactivationCountdownLabel(value: string) {
    const targetDate = parseDateInputValue(value);
    if (!targetDate) return "";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = targetDate.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / 86400000);

    if (diffDays === 0) return "La reactivacion es hoy.";
    if (diffDays === 1) return "Falta 1 dia para la reactivacion.";
    if (diffDays > 1) return `Faltan ${diffDays} dias para la reactivacion.`;
    if (diffDays === -1) return "La fecha fue ayer.";
    return `La fecha fue hace ${Math.abs(diffDays)} dias.`;
  }

  const selectedClient = useMemo(
    () => sortedClients.find((client) => String(client.id) === idCliente) ?? null,
    [sortedClients, idCliente]
  );
  const currentFormSignature = useMemo(
    () =>
      buildQuoteDraftSignature({
        idCliente,
        clientQuery,
        estado,
        moneda,
        fechaCotizacion,
        fechaVencimiento,
        fechaReactivacion1,
        fechaReactivacion2,
        fechaReactivacion3,
        reactivacionActiva,
        items,
        notas,
        plazoEntrega,
        formaPago,
        lugarEntrega,
        descuentoPorcentajeGlobal
      }),
    [
      clientQuery,
      descuentoPorcentajeGlobal,
      estado,
      fechaCotizacion,
      fechaReactivacion1,
      fechaReactivacion2,
      fechaReactivacion3,
      fechaVencimiento,
      formaPago,
      idCliente,
      items,
      lugarEntrega,
      moneda,
      notas,
      plazoEntrega,
      reactivacionActiva
    ]
  );
  const initialClientReady = !idCliente || (!!selectedClient && clientQuery === selectedClient.nombre_empresa);
  const initialItemsReady = ivaOptions.length === 0 || items.every((item) => Boolean(item.iva_porcentaje));
  const hasUnsavedChanges = initialFormSignature !== null && currentFormSignature !== initialFormSignature;

  useEffect(() => {
    if (initialFormSignature !== null || loading || draftLoading || !initialClientReady || !initialItemsReady) return;
    setInitialFormSignature(currentFormSignature);
  }, [currentFormSignature, draftLoading, initialClientReady, initialFormSignature, initialItemsReady, loading]);

  useBeforeUnload((event) => {
    if (allowNavigation || saving || !hasUnsavedChanges) return;
    event.preventDefault();
    event.returnValue = "";
  });

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (allowNavigation || saving || !hasUnsavedChanges || event.defaultPrevented) return;
      if (!(event.target instanceof Element)) return;

      const anchor = event.target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const targetUrl = new URL(anchor.href, window.location.href);
      if (targetUrl.origin !== window.location.origin) return;

      const nextPath = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextPath === currentPath) return;

      event.preventDefault();
      setPendingPath(nextPath);
      setExitModalOpen(true);
    }

    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, [allowNavigation, hasUnsavedChanges, saving]);

  function handleClientQueryChange(value: string) {
    setClientQuery(value);
    setClientSearchOpen(true);
    setActiveClientIndex(0);

    const normalized = normalizeSearchText(value);
    if (!normalized) {
      setIdCliente("");
      return;
    }

    const exactMatches = sortedClients.filter(
      (client) => normalizeSearchText(client.nombre_empresa) === normalized
    );

    if (exactMatches.length === 1) {
      setIdCliente(String(exactMatches[0]!.id));
      return;
    }

    if (!selectedClient || normalizeSearchText(selectedClient.nombre_empresa) !== normalized) {
      setIdCliente("");
    }
  }

  function selectClient(client: Client) {
    setIdCliente(String(client.id));
    setClientQuery(client.nombre_empresa);
    setClientSearchOpen(false);
    setActiveClientIndex(-1);
  }

  function handleProductQueryChange(index: number, value: string) {
    setItems((prev) => {
      const normalized = normalizeSearchText(value);
      const exactMatches = normalized
        ? sortedProducts.filter((product) => normalizeSearchText(product.nombre) === normalized)
        : [];

      return prev.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        if (!normalized) {
          return {
            ...item,
            id_producto: "",
            product_query: value,
            product_search_open: true,
            product_active_index: 0
          };
        }

        if (exactMatches.length === 1) {
          return {
            ...item,
            id_producto: String(exactMatches[0]!.id),
            product_query: exactMatches[0]!.nombre,
            product_search_open: true,
            product_active_index: 0
          };
        }

        const selectedProduct = sortedProducts.find((product) => String(product.id) === item.id_producto) ?? null;
        const keepCurrentSelection =
          selectedProduct && normalizeSearchText(selectedProduct.nombre) === normalized;

        return {
          ...item,
          id_producto: keepCurrentSelection ? item.id_producto : "",
          product_query: value,
          product_search_open: true,
          product_active_index: 0
        };
      });
    });
  }

  function selectProduct(index: number, product: Product) {
    setItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              id_producto: String(product.id),
              product_query: product.nombre,
              product_search_open: false,
              product_active_index: -1
            }
          : item
      )
    );
  }

  function handleProductSearchKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    const item = items[index];
    if (!item) return;
    const filteredProducts = getFilteredProducts(item.product_query);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setItems((prev) =>
        prev.map((current, currentIndex) => {
          if (currentIndex !== index) return current;
          if (!current.product_search_open) {
            return {
              ...current,
              product_search_open: true,
              product_active_index: filteredProducts.length > 0 ? 0 : -1
            };
          }
          return {
            ...current,
            product_active_index:
              filteredProducts.length === 0
                ? -1
                : current.product_active_index < filteredProducts.length - 1
                  ? current.product_active_index + 1
                  : 0
          };
        })
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setItems((prev) =>
        prev.map((current, currentIndex) => {
          if (currentIndex !== index) return current;
          if (!current.product_search_open) {
            return {
              ...current,
              product_search_open: true,
              product_active_index: filteredProducts.length > 0 ? filteredProducts.length - 1 : -1
            };
          }
          return {
            ...current,
            product_active_index:
              filteredProducts.length === 0
                ? -1
                : current.product_active_index > 0
                  ? current.product_active_index - 1
                  : filteredProducts.length - 1
          };
        })
      );
      return;
    }

    if (event.key === "Enter") {
      if (!item.product_search_open) return;
      if (item.product_active_index < 0 || item.product_active_index >= filteredProducts.length) return;
      event.preventDefault();
      selectProduct(index, filteredProducts[item.product_active_index]!);
      return;
    }

    if (event.key === "Escape") {
      if (!item.product_search_open) return;
      event.preventDefault();
      setItems((prev) =>
        prev.map((current, currentIndex) =>
          currentIndex === index ? { ...current, product_search_open: false, product_active_index: -1 } : current
        )
      );
    }
  }

  function handleClientSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!clientSearchOpen) {
        setClientSearchOpen(true);
        setActiveClientIndex(filteredClients.length > 0 ? 0 : -1);
        return;
      }
      setActiveClientIndex((current) => {
        if (filteredClients.length === 0) return -1;
        return current < filteredClients.length - 1 ? current + 1 : 0;
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!clientSearchOpen) {
        setClientSearchOpen(true);
        setActiveClientIndex(filteredClients.length > 0 ? filteredClients.length - 1 : -1);
        return;
      }
      setActiveClientIndex((current) => {
        if (filteredClients.length === 0) return -1;
        return current > 0 ? current - 1 : filteredClients.length - 1;
      });
      return;
    }

    if (event.key === "Enter") {
      if (!clientSearchOpen) return;
      if (activeClientIndex < 0 || activeClientIndex >= filteredClients.length) return;
      event.preventDefault();
      selectClient(filteredClients[activeClientIndex]!);
      return;
    }

    if (event.key === "Escape") {
      if (!clientSearchOpen) return;
      event.preventDefault();
      setClientSearchOpen(false);
      setActiveClientIndex(-1);
    }
  }

  function backToList() {
    requestNavigation(defaultExitPath);
  }

  function requestNavigation(path: string) {
    if (allowNavigation || saving || !hasUnsavedChanges) {
      navigate(path);
      return;
    }

    setPendingPath(path);
    setExitModalOpen(true);
  }

  function parseNewItemsForPayload() {
    return items
      .map((it) => {
        const id_producto = Number(it.id_producto);
        const cantidad = parseQty(it.cantidad);
        if (!Number.isFinite(id_producto) || id_producto <= 0 || !cantidad) return null;
        const ivaOk = parsePercentToBasisPoints(it.iva_porcentaje);
        if (ivaOk === null) return null;
        return {
          id_producto,
          cantidad,
          iva_porcentaje: it.iva_porcentaje.trim()
        };
      })
      .filter(
        (x): x is { id_producto: number; cantidad: number; iva_porcentaje: string } => x !== null
      );
  }

  async function saveDraft(nextPath?: string | null) {
    setError(null);
    setInfo(null);

    const idClienteNum = Number(idCliente);
    if (!Number.isFinite(idClienteNum) || idClienteNum <= 0) {
      setError("Seleccioná un cliente válido");
      return;
    }
    if (!isDiscountValid) {
      setError("El descuento global debe ser un porcentaje entre 0 y 100 (ej: 10 o 10.5)");
      return;
    }
    setSaving(true);
    try {
      const payloadItems = parseNewItemsForPayload();
      const fechaVencimientoIso = fechaVencimiento ? `${fechaVencimiento}T00:00:00.000Z` : undefined;
      const payload = {
        id_cliente: idClienteNum,
        moneda,
        estado: "BORRADOR",
        fecha_emision: `${fechaCotizacion}T00:00:00.000Z`,
        fecha_vencimiento: fechaVencimientoIso,
        fecha_reactivacion_1: fechaReactivacion1 ? `${fechaReactivacion1}T00:00:00.000Z` : undefined,
        fecha_reactivacion_2: fechaReactivacion2 ? `${fechaReactivacion2}T00:00:00.000Z` : undefined,
        fecha_reactivacion_3: fechaReactivacion3 ? `${fechaReactivacion3}T00:00:00.000Z` : undefined,
        reactivacion_activa: reactivacionActiva,
        descuento_porcentaje_global: normalizePercentInput(descuentoPorcentajeGlobal),
        tipo_cambio: moneda === "ARS" ? exchangeRate : "1",
        notas,
        plazo_entrega: plazoEntrega,
        forma_pago: formaPago,
        lugar_entrega: lugarEntrega,
        items: payloadItems
      };

      if (isEditMode) {
        await quoteService.updateQuoteDraft(editQuoteId, {
          ...payload,
          fecha_vencimiento: fechaVencimientoIso ?? null
        });
        showToast({ type: "success", text: "Borrador actualizado correctamente" });
        setAllowNavigation(true);
        navigate(nextPath ?? defaultExitPath);
      } else {
        await quoteService.createQuote(payload);
        showToast({ type: "success", text: "Borrador guardado correctamente" });
        setAllowNavigation(true);
        navigate(nextPath ?? "/quotes");
      }
    } catch (err) {
      setError(getErrorMessage(err, quoteErrorMessages, "No se pudo guardar el borrador"));
      setSaving(false);
    }
  }

  async function generateQuote() {
    setError(null);
    setInfo(null);

    const idClienteNum = Number(idCliente);
    if (!Number.isFinite(idClienteNum) || idClienteNum <= 0) {
      setError("Seleccioná un cliente válido");
      return;
    }
    if (!isDiscountValid) {
      setError("El descuento global debe ser un porcentaje entre 0 y 100 (ej: 10 o 10.5)");
      return;
    }
    const payloadItems = parseNewItemsForPayload();
    if (payloadItems.length === 0) {
      setError("Agregá al menos un producto con cantidad válida");
      return;
    }

    setSaving(true);
    try {
      const estadoToSend = estado === "BORRADOR" ? "EMITIDA" : estado;
      const fechaVencimientoIso = fechaVencimiento ? `${fechaVencimiento}T00:00:00.000Z` : undefined;
      const payload = {
        id_cliente: idClienteNum,
        moneda,
        estado: estadoToSend,
        fecha_emision: `${fechaCotizacion}T00:00:00.000Z`,
        fecha_vencimiento: fechaVencimientoIso,
        fecha_reactivacion_1: fechaReactivacion1 ? `${fechaReactivacion1}T00:00:00.000Z` : undefined,
        fecha_reactivacion_2: fechaReactivacion2 ? `${fechaReactivacion2}T00:00:00.000Z` : undefined,
        fecha_reactivacion_3: fechaReactivacion3 ? `${fechaReactivacion3}T00:00:00.000Z` : undefined,
        reactivacion_activa: reactivacionActiva,
        descuento_porcentaje_global: normalizePercentInput(descuentoPorcentajeGlobal),
        tipo_cambio: moneda === "ARS" ? exchangeRate : "1",
        notas,
        plazo_entrega: plazoEntrega,
        forma_pago: formaPago,
        lugar_entrega: lugarEntrega,
        items: payloadItems
      };

      const created = isEditMode ? null : await quoteService.createQuote(payload);
      if (isEditMode) {
        await quoteService.updateQuoteDraft(editQuoteId, {
          ...payload,
          fecha_vencimiento: fechaVencimientoIso ?? null
        });
      }

      const pdf = await quoteService.downloadQuotePdf(isEditMode ? editQuoteId : created!.id);
      downloadBlob(pdf.blob, pdf.filename ?? `cotizacion-${isEditMode ? editQuoteId : created!.id}.pdf`);
      showToast({ type: "success", text: "Cotización generada correctamente" });
      setAllowNavigation(true);
      navigate(isEditMode ? defaultExitPath : "/quotes");
    } catch (err) {
      setError(getErrorMessage(err, quoteErrorMessages, "No se pudo generar la cotización"));
      setSaving(false);
    }
  }

  return (
    <div className="page">
        <div className="stack">
          <div className="pageHeader" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 24, marginBottom: 8 }}>
            <div>
              <h1 className="pageTitle">Cotizaciones</h1>
              <div className="pageSubtitle" style={{ marginTop: 8 }}>
                <Link
                  to="/quotes"
                  style={{ textDecoration: "none", color: "inherit", opacity: 0.8 }}
                >
                  Cotizaciones
                </Link>
                <span style={{ margin: "0 6px", opacity: 0.5 }}>›</span> 
                <span style={{ fontWeight: 600 }}>
                  {isEditMode ? `Editar borrador #${editQuoteId}` : "Nueva cotización"}
                </span>
              </div>
            </div>
            <Button onClick={backToList} disabled={saving} className="btn--ghost" style={{ border: "none", fontWeight: 600, display: "flex", gap: 8 }}>
              <ReturnIcon /> Volver
            </Button>
          </div>

          {error ? <div className="error">{error}</div> : null}
          {info ? <div className="success">{info}</div> : null}

          <div className="sectionTitle" style={{ marginTop: 8 }}>Datos generales</div>
          <div className="divider" />

          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <label className="field">
              <span className="label">Cliente</span>
              <div className="clientSearch">
                <input
                  value={clientQuery}
                  onChange={(e) => handleClientQueryChange(e.target.value)}
                  onFocus={() => setClientSearchOpen(true)}
                  onKeyDown={handleClientSearchKeyDown}
                  onBlur={() => {
                    window.setTimeout(() => setClientSearchOpen(false), 150);
                  }}
                  className="input"
                  placeholder="Buscar cliente..."
                  autoComplete="off"
                />
                {clientSearchOpen ? (
                  <div className="clientSearchMenu">
                    {filteredClients.length > 0 ? (
                      filteredClients.map((client) => {
                        const isSelected = String(client.id) === idCliente;
                        const isActive = filteredClients[activeClientIndex]?.id === client.id;
                        return (
                          <button
                            key={client.id}
                            type="button"
                            className={`clientSearchOption ${isActive ? "clientSearchOption--active" : ""}`}
                            onMouseDown={(e) => e.preventDefault()}
                            onMouseEnter={() => setActiveClientIndex(filteredClients.findIndex((item) => item.id === client.id))}
                            onClick={() => selectClient(client)}
                          >
                            <span>{client.nombre_empresa}</span>
                            {isSelected ? <span className="clientSearchBadge">Seleccionado</span> : null}
                          </button>
                        );
                      })
                    ) : (
                      <div className="clientSearchEmpty">No hay clientes que coincidan con la búsqueda.</div>
                    )}
                  </div>
                ) : null}
              </div>
            </label>

            <label className="field">
              <span className="label">Estado de cotización</span>
              <select value={estado} onChange={(e) => setEstado(e.target.value)} className="select">
                <option value="BORRADOR">Borrador</option>
                <option value="EMITIDA">Emitida</option>
                <option value="ENVIADA">Enviada</option>
                <option value="POSPUESTA">Pospuesta</option>
                <option value="PEND_REACTIVACION">Pend. reactivación</option>
                <option value="CERRADA_PERDIDA">Cerrada perdida</option>
                <option value="CERRADA_GANADA">Cerrada ganada</option>
              </select>
            </label>

            <label className="field">
              <span className="label">Fecha de cotización</span>
              <input type="date" value={fechaCotizacion} onChange={(e) => setFechaCotizacion(e.target.value)} className="input" />
            </label>

            <label className="field">
              <span className="label">Moneda</span>
              <select value={moneda} onChange={(e) => setMoneda(e.target.value as CurrencyCode)} className="select">
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </label>

            <label className="field">
              <span className="label">Descuento global</span>
              <input
                value={descuentoPorcentajeGlobal}
                onChange={(e) => setDescuentoPorcentajeGlobal(e.target.value)}
                className="input"
                inputMode="decimal"
                placeholder="Ej: 10.5"
              />
            </label>

            <label className="field">
              <span className="label">Fecha de vencimiento</span>
              <input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} className="input" />
            </label>
          </div>



          <div className="sectionTitle">Productos</div>
          <div className="divider" />

          <div className="stack">
            <div className="productsHeaderGrid hint">
              <div>Nombre del producto</div>
              <div>Cantidad</div>
              <div>Impuestos</div>
              <div></div>
            </div>

            {items.map((it, idx) => (
              <div key={idx} className="productsRowGrid">
                <div className="clientSearch">
                  <input
                    value={it.product_query}
                    onChange={(e) => handleProductQueryChange(idx, e.target.value)}
                    onFocus={() =>
                      setItems((prev) =>
                        prev.map((item, itemIndex) =>
                          itemIndex === idx ? { ...item, product_search_open: true, product_active_index: 0 } : item
                        )
                      )
                    }
                    onKeyDown={(e) => handleProductSearchKeyDown(idx, e)}
                    onBlur={() => {
                      window.setTimeout(() => {
                        setItems((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === idx ? { ...item, product_search_open: false } : item
                          )
                        );
                      }, 150);
                    }}
                    className="input"
                    placeholder="Buscar producto..."
                    autoComplete="off"
                  />
                  {it.product_search_open ? (
                    <div className="clientSearchMenu">
                      {getFilteredProducts(it.product_query).length > 0 ? (
                        getFilteredProducts(it.product_query).map((product, productIndex, filteredProducts) => {
                          const isSelected = String(product.id) === it.id_producto;
                          const isActive = filteredProducts[it.product_active_index]?.id === product.id;
                          return (
                            <button
                              key={product.id}
                              type="button"
                              className={`clientSearchOption ${isActive ? "clientSearchOption--active" : ""}`}
                              onMouseDown={(e) => e.preventDefault()}
                              onMouseEnter={() =>
                                setItems((prev) =>
                                  prev.map((item, itemIndex) =>
                                    itemIndex === idx ? { ...item, product_active_index: productIndex } : item
                                  )
                                )
                              }
                              onClick={() => selectProduct(idx, product)}
                            >
                              <span>{product.nombre}</span>
                              {isSelected ? <span className="clientSearchBadge">Seleccionado</span> : null}
                            </button>
                          );
                        })
                      ) : (
                        <div className="clientSearchEmpty">No hay productos que coincidan con la búsqueda.</div>
                      )}
                    </div>
                  ) : null}
                </div>

                <input
                  value={it.cantidad}
                  onChange={(e) => setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, cantidad: e.target.value } : x)))}
                  inputMode="numeric"
                  className="input"
                />

                <select
                  value={it.iva_porcentaje}
                  onChange={(e) =>
                    setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, iva_porcentaje: e.target.value } : x)))
                  }
                  className="select"
                >
                  <option value="">Seleccionar</option>
                  {ivaOptions.map((option) => (
                    <option key={option.id} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <Button
                  type="button"
                  className="btn--icon btn--danger"
                  style={{ height: 42, width: 42 }}
                  disabled={items.length <= 1 || saving}
                  onClick={() => {
                    setItems((prev) => prev.filter((_, i) => i !== idx));
                  }}
                  title="Eliminar producto"
                >
                  <TrashIcon size={18} />
                </Button>
              </div>
            ))}

            <div className="row">
              <Button
                onClick={() =>
                  setItems((prev) => [
                    ...prev,
                    {
                      id_producto: "",
                      product_query: "",
                      product_search_open: false,
                      product_active_index: -1,
                      cantidad: "1",
                      iva_porcentaje: ivaOptions[0]?.value ?? ""
                    }
                  ])
                }
                disabled={saving}
                className="btn--ghost minw-280"
              >
                + Añadir otro producto
              </Button>
            </div>
          </div>

          <div className="sectionTitle">Resumen</div>
          <div className="divider" />

          <div className="summaryGrid">
            <div />
            <div className="card summaryCard">
              <div className="stack">
                <div className="summaryRow">
                  <span className="hint">Subtotal (antes de descuento):</span>
                  <span className="summaryValue">{formatSelectedMoney(preview.subtotalAntesDescuentoCents)}</span>
                </div>
                <div className="summaryRow">
                  <span className="hint">Descuento global ({descuentoPorcentajeGlobal}%):</span>
                  <span className="summaryValue">-{formatSelectedMoney(preview.descuentoCents)}</span>
                </div>
                <div className="summaryRow">
                  <span className="hint">Subtotal (sin impuestos):</span>
                  <span className="summaryValue">{formatSelectedMoney(preview.subtotalSinImpuestosCents)}</span>
                </div>
                <div className="summaryRow">
                  <span className="hint">Impuestos ({moneda}):</span>
                  <span className="summaryValue">{formatSelectedMoney(preview.impuestosCents)}</span>
                </div>
                <div className="divider" />
                <div className="summaryRow">
                  <span className="summaryTotalLabel">Total ({moneda}):</span>
                  <span className="summaryTotalValue">{formatSelectedMoney(preview.subtotalConImpuestosCents)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="sectionTitle">Información adicional</div>
          <div className="divider" />

          <label className="field">
            <span className="label">Notas</span>
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} className="textarea" />
          </label>

          <div className="quoteNewGrid">
            <label className="field">
              <span className="label">Plazo de entrega</span>
              <input value={plazoEntrega} onChange={(e) => setPlazoEntrega(e.target.value)} placeholder="Seleccionar" className="input" />
            </label>
            <label className="field">
              <span className="label">Forma de pago</span>
              <select value={formaPago} onChange={(e) => setFormaPago(e.target.value)} className="select">
                <option value="">Seleccionar</option>
                {formaPagoOptions.map((option) => (
                  <option key={option.id} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Lugar de entrega</span>
              <select value={lugarEntrega} onChange={(e) => setLugarEntrega(e.target.value)} className="select">
                <option value="">Seleccionar</option>
                {lugarEntregaOptions.map((option) => (
                  <option key={option.id} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="sectionTitle">Seguimiento de cotización</div>
          <div className="sectionSubtitle">Seleccioná tres fechas en las que recibirás una alerta para hacerle seguimiento a la cotización.</div>
          <div className="divider" />

          <div className="quoteNewGrid">
            <label className="field">
              <span className="label">Fecha de reactivación 1</span>
              <input type="date" value={fechaReactivacion1} onChange={(e) => setFechaReactivacion1(e.target.value)} className="input" />
              {fechaReactivacion1 ? <span className="hint">{getReactivationCountdownLabel(fechaReactivacion1)}</span> : null}
            </label>
            <label className="field">
              <span className="label">Fecha de reactivación 2</span>
              <input type="date" value={fechaReactivacion2} onChange={(e) => setFechaReactivacion2(e.target.value)} className="input" />
              {fechaReactivacion2 ? <span className="hint">{getReactivationCountdownLabel(fechaReactivacion2)}</span> : null}
            </label>
            <label className="field">
              <span className="label">Fecha de reactivación 3</span>
              <input type="date" value={fechaReactivacion3} onChange={(e) => setFechaReactivacion3(e.target.value)} className="input" />
              {fechaReactivacion3 ? <span className="hint">{getReactivationCountdownLabel(fechaReactivacion3)}</span> : null}
            </label>
            <label className="field">
              <span className="label">Reactivación activa</span>
              <select value={reactivacionActiva} onChange={(e) => setReactivacionActiva(Number(e.target.value) as 1 | 2 | 3)} className="select">
                <option value={1}>Fecha 1</option>
                <option value={2}>Fecha 2</option>
                <option value={3}>Fecha 3</option>
              </select>
              <span className="hint" style={{ visibility: "hidden" }}>
                Placeholder de alineacion
              </span>
            </label>
          </div>

          <div className="newActions">
            <Button disabled={saving || draftLoading} onClick={() => void saveDraft()} className="btn--ghost minw-170">
              {isEditMode ? "Guardar cambios" : "Guardar borrador"}
            </Button>
            <Button disabled={saving || draftLoading} onClick={() => void generateQuote()} className="btn--primary minw-170">
              Generar
            </Button>
            <Button disabled={saving || draftLoading} onClick={backToList} className="btn--danger minw-170">
              {isEditMode ? "Volver" : "Descartar"}
            </Button>
          </div>

          {saving ? <div className="hint">Procesando...</div> : null}
        </div>
        {exitModalOpen
          ? createPortal(
          <div className="modalOverlay" onClick={() => null}>
            <div className="modalContent modalContent--wide" onClick={(e) => e.stopPropagation()}>
              <h3>Abandonar cotización</h3>
              <p>Tenés una cotización en curso. Podés guardarla como borrador antes de salir o salir sin guardar.</p>
              <div className="modalActions modalActions--responsive" style={{ marginTop: 24 }}>
                <Button
                  onClick={() => {
                    setExitModalOpen(false);
                    setPendingPath(null);
                  }}
                  className="btn--ghost"
                  disabled={saving}
                >
                  Seguir editando
                </Button>
                <Button
                  onClick={() => void saveDraft(pendingPath)}
                  className="btn--primary"
                  disabled={saving}
                >
                  {saving ? "Guardando..." : "Guardar como borrador"}
                </Button>
                <Button
                  onClick={() => {
                    setAllowNavigation(true);
                    setExitModalOpen(false);
                    navigate(pendingPath ?? "/quotes");
                  }}
                  className="btn--danger"
                  disabled={saving}
                >
                  Salir sin guardar
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )
          : null}
    </div>
  );
}
