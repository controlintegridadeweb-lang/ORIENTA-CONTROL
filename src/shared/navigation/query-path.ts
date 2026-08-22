/** Monta uma URL interna apenas com parâmetros não vazios. */
export function queryPath(
  pathname: string,
  entries: Readonly<Record<string, string | undefined>>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    const normalized = value?.trim();
    if (normalized) params.set(key, normalized);
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
