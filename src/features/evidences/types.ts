import type { CycleState } from "@/shared/domain/types";
import type { ValidationStatus } from "./schemas";

export type EvidenceValidationEntry = {
  id: string;
  status: ValidationStatus;
  justification: string | null;
  validatedBy: string;
  validatedAt: string;
};

export type EvidenceListItem = {
  id: string;
  responseId: string;
  cycleId: string;
  cycleState: CycleState;
  organizationId: string;
  organizationName: string;
  formId: string;
  formName: string;
  formVersion: number;
  periodLabel: string;
  questionId: string;
  questionPrompt: string;
  /** Snapshot publicado em `question_versions.axis_name`. */
  axisName: string;
  /** Snapshot publicado em `question_versions.section_name`. */
  sectionName: string;
  requiresEvidence: boolean;
  title: string;
  description: string;
  evidenceType: string;
  storagePath: string | null;
  externalLink: string | null;
  textBody: string | null;
  exceptionReason: string | null;
  submittedAt: string;
  submittedBy: string;
  currentStatus: ValidationStatus;
  lastValidatedAt: string | null;
  lastJustification: string | null;
  history: EvidenceValidationEntry[];
};

export type EvidencesListResult = {
  items: EvidenceListItem[];
  total: number;
  limit: number;
  offset: number;
};

export type EvidenceStatsResult = {
  total: number;
  aguardando_envio: number;
  aguardando_validacao: number;
  ajuste_solicitado: number;
  aprovadas: number;
  nao_aprovadas: number;
};

export type EvidenceFilterOptions = {
  forms: { id: string; name: string; version: number }[];
  organizations: { id: string; name: string }[];
};
