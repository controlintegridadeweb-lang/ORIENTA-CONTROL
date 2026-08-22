import type { FamiSectionSnapshot } from "@/features/fami/queries";

export type FamiSectionSortKey = "name" | "percentage" | "level";
export type SortDirection = "asc" | "desc";

/**
 * Ordena seções FAMI sem interpretar escopos N/A como desempenho zero.
 * Em ordenações de desempenho, seções não aplicáveis permanecem ao final.
 */
export function sortFamiSections(
  sections: FamiSectionSnapshot[],
  sort: FamiSectionSortKey,
  direction: SortDirection,
): FamiSectionSnapshot[] {
  const factor = direction === "asc" ? 1 : -1;

  return [...sections].sort((left, right) => {
    if (sort === "name") {
      return left.sectionName.localeCompare(right.sectionName, "pt-BR") * factor;
    }

    const leftApplicable = left.maturityLevel != null;
    const rightApplicable = right.maturityLevel != null;
    if (leftApplicable !== rightApplicable) return leftApplicable ? -1 : 1;

    if (!leftApplicable && !rightApplicable) {
      return left.sectionName.localeCompare(right.sectionName, "pt-BR");
    }

    const comparison = sort === "level"
      ? left.maturityLevel! - right.maturityLevel!
      : left.percentage - right.percentage;

    return comparison * factor || left.sectionName.localeCompare(right.sectionName, "pt-BR");
  });
}
