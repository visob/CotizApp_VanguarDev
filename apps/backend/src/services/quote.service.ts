export function parseMoneyToCents(value: unknown) {
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

export function centsToMoneyString(cents: bigint) {
  const sign = cents < 0n ? "-" : "";
  const abs = cents < 0n ? -cents : cents;
  const whole = abs / 100n;
  const frac = abs % 100n;
  return `${sign}${whole.toString()}.${frac.toString().padStart(2, "0")}`;
}

export function parsePercentToBasisPoints(value: unknown) {
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

export function basisPointsToPercentString(bp: bigint) {
  const sign = bp < 0n ? "-" : "";
  const abs = bp < 0n ? -bp : bp;
  const whole = abs / 100n;
  const frac = abs % 100n;
  return `${sign}${whole.toString()}.${frac.toString().padStart(2, "0")}`;
}

export function parseDecimalString(value: unknown, maxDecimals: number) {
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
  const normalized = raw.replace(",", ".").trim();
  if (!normalized) return null;

  const decimals = Math.max(0, Math.trunc(maxDecimals));
  const regex = new RegExp(`^(\\d+)(?:\\.(\\d{1,${decimals}}))?$`);
  const match = normalized.match(regex);
  if (!match) return null;

  const whole = match[1] ?? "0";
  const frac = match[2];
  return frac ? `${whole}.${frac}` : whole;
}

export function calcIvaCents(subtotalCents: bigint, ivaBasisPoints: bigint) {
  const numerator = subtotalCents * ivaBasisPoints;
  return (numerator + 5000n) / 10000n;
}

export function calculateQuoteTotalsFromLines(input: {
  lines: Array<{ grossSubtotalCents: bigint; ivaBasisPoints: bigint }>;
  globalDiscountBasisPoints: bigint;
}) {
  const discountBp = input.globalDiscountBasisPoints >= 0n ? input.globalDiscountBasisPoints : 0n;

  const discountCents = input.lines.reduce((acc, line) => {
    const d = (line.grossSubtotalCents * discountBp + 5000n) / 10000n;
    return acc + d;
  }, 0n);

  const subtotalAfterDiscountCents = input.lines.reduce((acc, line) => {
    const d = (line.grossSubtotalCents * discountBp + 5000n) / 10000n;
    const net = line.grossSubtotalCents > d ? line.grossSubtotalCents - d : 0n;
    return acc + net;
  }, 0n);

  const ivaCents = input.lines.reduce((acc, line) => {
    const d = (line.grossSubtotalCents * discountBp + 5000n) / 10000n;
    const net = line.grossSubtotalCents > d ? line.grossSubtotalCents - d : 0n;
    return acc + calcIvaCents(net, line.ivaBasisPoints);
  }, 0n);

  const totalBeforeDiscountCents = subtotalAfterDiscountCents + ivaCents;
  const totalFinalCents = totalBeforeDiscountCents;

  return {
    subtotalCents: subtotalAfterDiscountCents,
    ivaCents,
    totalBeforeDiscountCents,
    totalFinalCents,
    discountCents
  };
}
