/** Download da planilha de perguntas e respostas de um diagnóstico. */
export function cycleAnswersExportPath(cycleId: string): string {
  return `/api/cycles/${encodeURIComponent(cycleId)}/answers/export`;
}
