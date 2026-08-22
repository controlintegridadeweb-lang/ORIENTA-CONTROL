/**
 * Normaliza titulos e descricoes vindos do workbench / staging para copy
 * amigavel em PT-BR na fila de evidencias.
 */
export function normalizeWorkbenchText(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized === "evidence registered by workbench") {
    return "Evidência registrada pela Área de Trabalho";
  }
  if (normalized === "evidencia registrada pelo workbench") {
    return "Evidência registrada pela Área de Trabalho";
  }
  if (normalized === "evidencia registrada pela area de trabalho") {
    return "Evidência registrada pela Área de Trabalho";
  }
  if (normalized === "automated record for validation flow") {
    return "Registro automatizado para fluxo de validação";
  }
  if (normalized === "automated record for validation flow in staging") {
    return "Registro automatizado para fluxo de validação em homologação";
  }
  if (normalized === "validation logged in workbench") {
    return "Validação registrada na Área de Trabalho";
  }
  if (normalized === "validacao registrada no workbench") {
    return "Validação registrada na Área de Trabalho";
  }
  if (normalized === "validation in staging environment") {
    return "Validação em ambiente de homologação";
  }
  return value;
}
