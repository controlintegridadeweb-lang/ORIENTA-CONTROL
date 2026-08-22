import {
  axisColorKeyForName,
  structuralAxisOrderIndex,
  type AxisColorKey,
} from "@/features/fami/fami-axis-display";
import type { FamiSectionSnapshot } from "@/features/fami/read-types";

export type SectionDetailRow = {
  axisId: string;
  axisLabel: string;
  axisOrder: number;
  axisColorKey: AxisColorKey | "unknown";
  sectionId: string;
  sectionLabel: string;
  sectionOrder: number;
  /** Posição oficial da seção no formulário (`section_order`). */
  formOrder: number;
  percentage: number;
  maturityLevel: number | null;
  maturityLevelLabel: string;
  pointsEarned: number;
  pointsPossible: number;
};

export type SectionDetailAxisGroup = {
  axisId: string;
  axisLabel: string;
  axisOrder: number;
  axisColorKey: AxisColorKey | "unknown";
  sections: SectionDetailRow[];
};

function maturityLevelLabel(level: number | null): string {
  return level == null ? "N/A" : `Nível ${level}`;
}

function toDetailRow(section: FamiSectionSnapshot): SectionDetailRow {
  const colorKey = axisColorKeyForName(section.axisName) ?? "unknown";
  const axisOrder = structuralAxisOrderIndex(section.axisName) + 1;
  return {
    axisId: section.axisId,
    axisLabel: section.axisName,
    axisOrder,
    axisColorKey: colorKey,
    sectionId: section.sectionId,
    sectionLabel: section.sectionName,
    sectionOrder: section.sectionOrder,
    formOrder: section.sectionOrder,
    percentage: section.percentage,
    maturityLevel: section.maturityLevel,
    maturityLevelLabel: maturityLevelLabel(section.maturityLevel),
    pointsEarned: section.pointsObtained,
    pointsPossible: section.pointsPossible,
  };
}

/**
 * Ordena seções pela ordem oficial do formulário:
 * 1) eixo estrutural (Governança → Ambiental → Social);
 * 2) `section_order` congelado;
 * 3) nome (desempate estável).
 */
export function sortSectionsByFormOrder(
  sections: readonly FamiSectionSnapshot[],
): FamiSectionSnapshot[] {
  return [...sections].sort((a, b) => {
    const axisDiff =
      structuralAxisOrderIndex(a.axisName) - structuralAxisOrderIndex(b.axisName);
    if (axisDiff !== 0) return axisDiff;
    const orderDiff = a.sectionOrder - b.sectionOrder;
    if (orderDiff !== 0) return orderDiff;
    return a.sectionName.localeCompare(b.sectionName, "pt-BR");
  });
}

/** Prepara linhas de detalhamento já ordenadas na sequência oficial do formulário. */
export function buildSectionDetailRows(
  sections: readonly FamiSectionSnapshot[],
): SectionDetailRow[] {
  return sortSectionsByFormOrder(sections).map(toDetailRow);
}

/** Agrupa linhas por eixo, preservando a ordem oficial já aplicada. */
export function groupSectionDetailRowsByAxis(
  rows: readonly SectionDetailRow[],
): SectionDetailAxisGroup[] {
  const groups: SectionDetailAxisGroup[] = [];
  const indexByAxisId = new Map<string, number>();

  for (const row of rows) {
    const existing = indexByAxisId.get(row.axisId);
    if (existing != null) {
      groups[existing]?.sections.push(row);
      continue;
    }
    indexByAxisId.set(row.axisId, groups.length);
    groups.push({
      axisId: row.axisId,
      axisLabel: row.axisLabel,
      axisOrder: row.axisOrder,
      axisColorKey: row.axisColorKey,
      sections: [row],
    });
  }

  return groups;
}
