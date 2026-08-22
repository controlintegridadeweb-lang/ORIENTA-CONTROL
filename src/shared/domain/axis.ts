/** Ordem institucional dos eixos estruturais da plataforma. */
export const STRUCTURAL_AXIS_ORDER = ["Governanca", "Ambiental", "Social"] as const;

/** Normaliza o nome do eixo para comparações de domínio, sem depender da camada visual. */
export function normalizeAxisNameKey(axisName: string): string {
  return axisName
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

/** Índice institucional do eixo; eixos não estruturais ficam após os oficiais. */
export function structuralAxisOrderIndex(axisName: string): number {
  const normalized = normalizeAxisNameKey(axisName);
  const index = STRUCTURAL_AXIS_ORDER.findIndex(
    (name) => normalizeAxisNameKey(name) === normalized,
  );
  return index >= 0 ? index : STRUCTURAL_AXIS_ORDER.length;
}
