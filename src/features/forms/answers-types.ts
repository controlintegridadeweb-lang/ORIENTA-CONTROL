/**
 * Tipos compartilhados entre servico, rotas API e UI da aba "Respostas" do
 * modulo Formularios. Mantidos isolados de `admin-service.ts` para deixar
 * claro que aqui e leitura/agregacao (nao CRUD).
 *
 * Convencao de "respondente": no dominio da Plataforma Orienta um respondente
 * e uma execução de ciclo por organização. Um mesmo órgão pode participar de
 * ciclos diferentes do mesmo formulário; por isso qualquer detalhe operacional
 * é identificado por `cycleId`. O detalhe lista os usuários que contribuíram
 * via `responses.created_by`.
 */

import { evidenceLabels } from "@/shared/labels/official-labels";

/** Resposta enumerada (DB enum `answer_value`). */
export type AnswerValue = "yes" | "no" | "not_applicable";

/** O formulário operacional usa exclusivamente respostas objetivas. */
export type QuestionAnswerType = "yes_no";

/** Rótulo de negócio; nunca expõe o valor técnico armazenado na API. */
export const QUESTION_ANSWER_TYPE_LABEL: Record<QuestionAnswerType, string> = {
  yes_no: "Sim, Não ou Não se aplica",
};

/** Status agregado do respondente (orgao) sobre o formulario. */
export type RespondentStatus =
  | "nao_iniciada"
  | "em_preenchimento"
  | "completa"
  | "submetida"
  | "em_complementacao";

export const RESPONDENT_STATUS_VALUES: readonly RespondentStatus[] = [
  "nao_iniciada",
  "em_preenchimento",
  "completa",
  "submetida",
  "em_complementacao",
] as const;

export type AnswersOverview = {
  formId: string;
  formName: string;
  /** Órgãos com pelo menos uma resposta em qualquer ciclo do formulário. */
  totalRespondents: number;
  /** Ciclos exibidos e classificados no recorte atual. */
  totalCycles: number;
  totalQuestions: number;
  lastAnswerAt: string | null;
  /** Quantidade de orgaos em cada bucket de status (chaves sempre presentes). */
  statusBreakdown: Record<RespondentStatus, number>;
};

/** Contagem por valor enumerado da pergunta (apenas para tipos objetivos). */
export type AnswerValueDistribution = {
  yes: number;
  no: number;
  not_applicable: number;
};

export type AnswersSummaryQuestion = {
  questionId: string;
  orderIndex: number;
  prompt: string;
  answerType: QuestionAnswerType;
  totalResponses: number;
  distribution: AnswerValueDistribution;
};

export type AnswersSummary = {
  formId: string;
  totalRespondents: number;
  questions: AnswersSummaryQuestion[];
};

export type RespondentRow = {
  cycleId: string;
  organizationId: string;
  organizationName: string;
  periodLabel: string;
  answeredQuestions: number;
  totalQuestions: number;
  lastUpdatedAt: string;
  status: RespondentStatus;
  /** Quantidade de usuarios distintos que ja contribuiram com alguma resposta. */
  contributorCount: number;
};

export type RespondentListCursor = {
  /** ISO timestamp do `lastUpdatedAt` da ultima linha da pagina anterior. */
  updatedAt: string;
  /** Tiebreaker entre ciclos com a mesma atualização. */
  cycleId: string;
};

export type RespondentListPage = {
  rows: RespondentRow[];
  nextCursor: RespondentListCursor | null;
};

export type RespondentFilterOptions = {
  organizations: { id: string; name: string }[];
};

/** Detalhe de uma celula de resposta exibida na visao individual. */
export type RespondentAnswerCell = {
  questionId: string;
  orderIndex: number;
  prompt: string;
  answerType: QuestionAnswerType;
  answer: AnswerValue | null;
  notes: string | null;
  updatedAt: string | null;
  createdByUserId: string | null;
  createdByName: string | null;
  /** Pergunta não aplicável a esta organização por regra administrativa. */
  isWaived: boolean;
  waiverReason: string | null;
  /** Respondente marcou "Não se aplica neste diagnóstico" (sinal persistido em responses). */
  isNotApplicable: boolean;
  requiresEvidence: boolean;
  famiEnabled: boolean;
  evidences: Array<{
    id: string;
    title: string;
    description: string | null;
    externalLink: string | null;
    storagePath: string | null;
    validationStatus: string | null;
  }>;
};

export type RespondentContributor = {
  userId: string;
  fullName: string | null;
  /** Numero de respostas em que este usuario aparece como `created_by`. */
  contributions: number;
};

export type RespondentDetail = {
  cycleId: string;
  /** Estado bruto do ciclo (fonte para pontuação oficial vs. provisória). */
  cycleState: string;
  periodLabel: string;
  organizationId: string;
  organizationName: string;
  status: RespondentStatus;
  answeredQuestions: number;
  totalQuestions: number;
  /** Perguntas não aplicáveis a esta organização por regra administrativa. */
  waivedQuestions: number;
  /**
   * Total efetivo de perguntas aplicáveis à organização (total menos regras administrativas e respostas não aplicáveis).
   * Usado para o progresso e para a contagem na visao individual.
   */
  applicableQuestions: number;
  lastUpdatedAt: string | null;
  firstAnsweredAt: string | null;
  contributors: RespondentContributor[];
  answers: RespondentAnswerCell[];
};

export type AnswersListFilters = {
  organizationId?: string | null;
  status?: RespondentStatus | null;
  /** ISO date (inclusive, comparado contra `lastUpdatedAt`). */
  from?: string | null;
  /** ISO date (inclusive, comparado contra `lastUpdatedAt`). */
  to?: string | null;
};

export type AnswersListQuery = AnswersListFilters & {
  cursor?: RespondentListCursor | null;
  limit?: number;
};

export type AnswersExportFormat = "csv" | "pdf" | "xlsx";

export const RESPONDENT_LIST_DEFAULT_LIMIT = 25;
export const RESPONDENT_LIST_MAX_LIMIT = 100;

/** Rotulos PT para `RespondentStatus`. */
export const RESPONDENT_STATUS_LABEL: Record<RespondentStatus, string> = {
  nao_iniciada: "Não iniciada",
  em_preenchimento: "Em preenchimento",
  completa: "Completa",
  submetida: "Submetida",
  em_complementacao: evidenceLabels.answersOrgStatus,
};
