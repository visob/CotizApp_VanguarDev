function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function extractIsoDate(value: string | null | undefined) {
  if (!value) return null;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function formatIsoDate(value: string | null | undefined, fallback = "-") {
  const isoDate = extractIsoDate(value);
  if (!isoDate) return fallback;

  const [year, month, day] = isoDate.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC"
  }).format(utcDate);
}

export function getLocalTodayIsoDate() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
