export function getErrorMessage(
  error: unknown,
  dictionary: Record<string, string>,
  fallback = "Ocurrió un error inesperado"
) {
  if (error instanceof Error) {
    return dictionary[error.message] ?? error.message ?? fallback;
  }
  return fallback;
}
