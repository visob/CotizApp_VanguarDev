export function assertDefined<T>(
  value: T | undefined | null,
  message = "Valor requerido"
): T {
  if (value === undefined || value === null) {
    throw new Error(message);
  }
  return value;
}

