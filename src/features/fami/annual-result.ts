import { famiAnnualLabels } from "@/shared/labels/official-labels";
import { isCalendarYearClosed } from "@/features/fami/fami-year";

export type AnnualFamiDisplay = {
  published: boolean;
  percentage: number | null;
  maturityLevel: number | null;
  label: string;
};

/**
 * O bloco FAMI anual só publica o percentual depois do fechamento do ano civil.
 * Antes disso o diagnóstico oficial existe, mas não é o resultado anual.
 */
export function resolveAnnualFamiDisplay(input: {
  referenceYear: number;
  percentage: number | null | undefined;
  maturityLevel: number | null | undefined;
  now?: Date;
}): AnnualFamiDisplay {
  const yearClosed = isCalendarYearClosed(input.referenceYear, input.now ?? new Date());
  const hasScore = input.maturityLevel != null && input.percentage != null;
  if (!yearClosed || !hasScore) {
    return {
      published: false,
      percentage: null,
      maturityLevel: null,
      label: famiAnnualLabels.pending,
    };
  }
  return {
    published: true,
    percentage: input.percentage ?? null,
    maturityLevel: input.maturityLevel ?? null,
    label: famiAnnualLabels.percentageLabel,
  };
}
