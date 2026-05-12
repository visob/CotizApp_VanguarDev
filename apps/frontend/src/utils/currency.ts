import type { CurrencyCode } from "../types";

export function formatMoney(amount: number, currency: CurrencyCode) {
  const locale = currency === "ARS" ? "es-AR" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency
  }).format(amount);
}

