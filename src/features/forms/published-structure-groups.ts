import type { PublishedFormQuestion } from "./published-structure-types";

export type PublishedStructureSectionGroup = {
  sectionName: string;
  questions: PublishedFormQuestion[];
};

export type PublishedStructureAxisGroup = {
  axisName: string;
  sections: PublishedStructureSectionGroup[];
};

export const PUBLISHED_STRUCTURE_PAGE_SIZES = [5, 10, 20] as const;
export type PublishedStructurePageSize = (typeof PUBLISHED_STRUCTURE_PAGE_SIZES)[number];
export const DEFAULT_PUBLISHED_STRUCTURE_PAGE_SIZE: PublishedStructurePageSize = 10;

/** Agrupa perguntas na ordem recebida: Eixo → Seção → Perguntas. */
export function groupPublishedQuestions(
  questions: readonly PublishedFormQuestion[],
): PublishedStructureAxisGroup[] {
  const axes: PublishedStructureAxisGroup[] = [];
  const axisIndex = new Map<string, PublishedStructureAxisGroup>();
  const sectionIndex = new Map<string, PublishedStructureSectionGroup>();

  for (const question of questions) {
    let axis = axisIndex.get(question.axisName);
    if (!axis) {
      axis = { axisName: question.axisName, sections: [] };
      axisIndex.set(question.axisName, axis);
      axes.push(axis);
    }

    const sectionKey = `${question.axisName}\0${question.sectionName}`;
    let section = sectionIndex.get(sectionKey);
    if (!section) {
      section = { sectionName: question.sectionName, questions: [] };
      sectionIndex.set(sectionKey, section);
      axis.sections.push(section);
    }
    section.questions.push(question);
  }

  return axes;
}

/**
 * Pagina pela unidade pergunta e reconstrói a hierarquia apenas com
 * eixos/seções que possuem itens na página atual.
 */
export function paginatePublishedQuestions(
  questions: readonly PublishedFormQuestion[],
  page: number,
  pageSize: number,
): {
  groups: PublishedStructureAxisGroup[];
  pageQuestions: PublishedFormQuestion[];
  totalItems: number;
  totalPages: number;
  safePage: number;
  safePageSize: number;
  rangeStart: number;
  rangeEnd: number;
} {
  const totalItems = questions.length;
  const safePageSize = Math.max(1, Math.trunc(pageSize));
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safePage = Math.min(Math.max(1, Math.trunc(page)), totalPages);
  const startIndex = (safePage - 1) * safePageSize;
  const pageQuestions = questions.slice(startIndex, startIndex + safePageSize);
  const pageItemCount = pageQuestions.length;

  return {
    groups: groupPublishedQuestions(pageQuestions),
    pageQuestions,
    totalItems,
    totalPages,
    safePage,
    safePageSize,
    rangeStart: pageItemCount === 0 ? 0 : startIndex + 1,
    rangeEnd: startIndex + pageItemCount,
  };
}

export function parsePublishedStructurePageSize(
  value: string | null | undefined,
): PublishedStructurePageSize {
  const parsed = Number(value);
  if (PUBLISHED_STRUCTURE_PAGE_SIZES.includes(parsed as PublishedStructurePageSize)) {
    return parsed as PublishedStructurePageSize;
  }
  return DEFAULT_PUBLISHED_STRUCTURE_PAGE_SIZE;
}

export function parsePublishedStructurePage(value: string | null | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}
