import type { AxisMaturity } from "./types";

type FamiGlobalSnapshot = {
  percentage: number;
  maturityLevel: number | null;
  pointsObtained: number;
  pointsPossible: number;
  createdAt: string;
};

export type FamiSectionSnapshot = {
  sectionId: string;
  sectionName: string;
  /** Ordem oficial da seção no formulário (`section_order` congelado). */
  sectionOrder: number;
  axisId: string;
  axisName: string;
  percentage: number;
  maturityLevel: number | null;
  pointsObtained: number;
  pointsPossible: number;
};

export type FamiSnapshot = {
  formId: string;
  organizationId: string;
  /** Nulo em painel comparativo, pois não existe uma versão única de processamento. */
  processingVersion: number | null;
  /** Política matemática congelada no processamento selecionado. */
  policyVersion: string | null;
  global: FamiGlobalSnapshot | null;
  axes: AxisMaturity[];
  sections: FamiSectionSnapshot[];
  /** Alertas para dados legados incompletos ou fora do escopo congelado. */
  integrityWarnings?: string[];
};

export type FamiEvolutionPoint = {
  processingVersion: number;
  policyVersion: string;
  createdAt: string;
  globalPercentage: number | null;
  globalMaturityLevel: number | null;
  /** Eixo nome -> percentual */
  axisPercentages: Record<string, number | null>;
};

/** Um ponto por ano civil BRT: último processamento global daquele ano. */
export type FamiEvolutionYearPoint = {
  year: number;
  processingVersion: number;
  policyVersion: string;
  createdAt: string;
  globalPercentage: number | null;
  globalMaturityLevel: number | null;
  axisPercentages: Record<string, number | null>;
};

