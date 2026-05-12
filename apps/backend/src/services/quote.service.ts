import type { CurrencyCode } from "../types/index.js";

export function calculateQuoteTotals(input: {
  currency: CurrencyCode;
  exchangeRate: number;
  subtotal: number;
  ivaPercent: number;
  globalDiscount: number;
}) {
  const ivaAmount = input.subtotal * (input.ivaPercent / 100);
  const totalBeforeDiscount = input.subtotal + ivaAmount;
  const totalFinal = Math.max(0, totalBeforeDiscount - input.globalDiscount);

  return {
    ivaAmount,
    totalFinal
  };
}
