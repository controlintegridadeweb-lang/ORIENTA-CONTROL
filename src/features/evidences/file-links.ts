/** Endpoint autenticado para visualizar ou baixar um arquivo de evidência. */
export function evidenceFileUrl(
  evidenceId: string,
  options: { download?: boolean } = {},
): string {
  const base = `/api/evidences/${encodeURIComponent(evidenceId)}/file`;
  return options.download ? `${base}?download=1` : base;
}
