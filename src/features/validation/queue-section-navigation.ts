import type {
  QueueSectionItem,
  QueueSectionNavGroup,
  QueueSectionNavigation,
  QueueSectionSummary,
} from "./queue-types";

export const ALL_SECTIONS_PARAM = "all";
export const ALL_AXES_PARAM = "all";

export function sectionSelectorStatusSuffix(
  pendingCount: number,
  totalCount: number,
): string {
  if (totalCount === 0) return " — sem itens para validar";
  if (pendingCount === 0) return " — concluída";
  if (pendingCount === 1) return " — 1 pendente";
  return ` — ${pendingCount} pendentes`;
}

/** Rótulo compacto para chips de seção (sem travessão longo). */
export function sectionChipStatusLabel(
  pendingCount: number,
  totalCount: number,
): string {
  if (totalCount === 0) return "Sem itens";
  if (pendingCount === 0) return "Concluída";
  if (pendingCount === 1) return "1 pendente";
  return `${pendingCount} pendentes`;
}

export function axisPendingCount(
  group: Pick<QueueSectionNavGroup, "sections">,
): number {
  return group.sections.reduce(
    (total, section) => total + section.pendingCount,
    0,
  );
}

export function resolveSelectedAxisId(
  requested: string | null | undefined,
  groups: QueueSectionNavGroup[],
): string {
  if (!requested || requested === ALL_AXES_PARAM) return ALL_AXES_PARAM;
  return groups.some((group) => group.axisId === requested)
    ? requested
    : ALL_AXES_PARAM;
}

/**
 * Seção preferida ao trocar de eixo: primeira com pendência.
 * Não escolhe seção concluída enquanto houver pendentes no eixo.
 */
export function pickPreferredSectionIdForAxis(
  sections: QueueSectionSummary[],
): string | null {
  const pending = sections.find((section) => section.pendingCount > 0);
  return pending?.id ?? null;
}

export function sectionsForAxis(
  sections: QueueSectionSummary[],
  axisId: string | null | undefined,
): QueueSectionSummary[] {
  if (!axisId || axisId === ALL_AXES_PARAM) return sections;
  return sections.filter((section) => section.axisId === axisId);
}

export function formSectionsCoverageCaption(
  formSectionCount: number,
  sectionsWithoutTabItems: number,
): string {
  if (formSectionCount <= 0) return "";
  if (sectionsWithoutTabItems <= 0) {
    return `${formSectionCount} de ${formSectionCount} seções conferidas — nenhuma seção ausente`;
  }
  const label =
    sectionsWithoutTabItems === 1
      ? "seção sem itens para validar"
      : "seções sem itens para validar";
  return `${formSectionCount} de ${formSectionCount} seções conferidas — ${sectionsWithoutTabItems} ${label} na aba atual`;
}

export function axisFormOrder(axisName: string): number {
  const key = axisName
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
  if (key.startsWith("governan")) return 0;
  if (key.startsWith("ambiental")) return 1;
  if (key.startsWith("social")) return 2;
  return 100;
}

export function compareSectionCatalogOrder(
  a: Pick<QueueSectionSummary, "axisName" | "sectionOrder" | "title">,
  b: Pick<QueueSectionSummary, "axisName" | "sectionOrder" | "title">,
): number {
  const byAxisOrder = axisFormOrder(a.axisName) - axisFormOrder(b.axisName);
  if (byAxisOrder !== 0) return byAxisOrder;
  const byAxis = a.axisName.localeCompare(b.axisName, "pt-BR");
  if (byAxis !== 0) return byAxis;
  if (a.sectionOrder !== b.sectionOrder) return a.sectionOrder - b.sectionOrder;
  return a.title.localeCompare(b.title, "pt-BR");
}

export function groupSectionsByAxis(
  sections: QueueSectionSummary[],
): QueueSectionNavGroup[] {
  const groups: QueueSectionNavGroup[] = [];
  for (const section of [...sections].sort(compareSectionCatalogOrder)) {
    const current = groups.at(-1);
    if (current?.axisId === section.axisId) {
      current.sections.push(section);
      continue;
    }
    groups.push({
      axisId: section.axisId,
      axisName: section.axisName,
      sections: [section],
    });
  }
  return groups;
}

export function buildSectionNavigation(
  items: QueueSectionItem[],
): QueueSectionNavigation {
  const bySection = new Map<string, QueueSectionSummary>();

  for (const item of items) {
    const awaitingAdmin = [
      "pending",
      "not_presented",
      "proof_requested",
      "adjustment_requested",
    ].includes(item.status);
    const current = bySection.get(item.sectionId);
    if (current) {
      current.pendingCount += awaitingAdmin ? 1 : 0;
      current.completedCount += awaitingAdmin ? 0 : 1;
      current.totalCount += 1;
      continue;
    }
    bySection.set(item.sectionId, {
      id: item.sectionId,
      title: item.sectionName,
      axisId: item.axisId,
      axisName: item.axisName,
      sectionOrder: item.sectionOrder,
      pendingCount: awaitingAdmin ? 1 : 0,
      completedCount: awaitingAdmin ? 0 : 1,
      totalCount: 1,
    });
  }

  const sections = [...bySection.values()].sort(compareSectionCatalogOrder);
  return {
    groups: groupSectionsByAxis(sections),
    sections,
    totalPending: sections.reduce((sum, item) => sum + item.pendingCount, 0),
    totalCompleted: sections.reduce((sum, item) => sum + item.completedCount, 0),
    total: items.length,
  };
}

export function resolveSelectedSectionId(
  requested: string | null | undefined,
  sections: QueueSectionSummary[],
): string {
  if (!requested || requested === ALL_SECTIONS_PARAM) return ALL_SECTIONS_PARAM;
  return sections.some((section) => section.id === requested)
    ? requested
    : ALL_SECTIONS_PARAM;
}
