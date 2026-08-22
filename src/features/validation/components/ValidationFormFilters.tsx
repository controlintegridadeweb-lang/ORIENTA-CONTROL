"use client";

import type { ReactNode } from "react";
import {
  FORM_ADMIN_DECISION_FILTER_LABEL,
  FORM_ANALYSIS_SITUATION_LABEL,
  FORM_ANSWER_FILTER_LABEL,
  FORM_PROOF_FILTER_LABEL,
  QUEUE_SITUATION_FILTER_LABEL,
  type FormAdminDecisionFilter,
  type FormAnalysisSituation,
  type FormAnswerFilter,
  type FormProofFilter,
  type QueueSituationFilter,
} from "@/features/validation/form-view-model";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";

const QUEUE_SITUATIONS: QueueSituationFilter[] = [
  "pending",
  "awaiting_complement",
  "completed",
  "all",
];

/** Filtros da fila de validação — sem abas de escopo. */
export function ValidationQueueFilters({
  situation,
  search,
  onSituationChange,
  onSearchChange,
  fullFormHref,
  sectionNavigation,
  toolbarStart,
  toolbarActions,
}: {
  situation: QueueSituationFilter;
  search: string;
  onSituationChange: (value: QueueSituationFilter) => void;
  onSearchChange: (value: string) => void;
  fullFormHref: string;
  sectionNavigation?: ReactNode;
  /** Conteúdo à esquerda da barra de ações (ex.: situação ativa). */
  toolbarStart?: ReactNode;
  /** Ações extras à direita, após o link do formulário completo. */
  toolbarActions?: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-4">
      <h2
        id="validation-queue-filters-title"
        className={typography.sectionTitle}
      >
        Filtros
      </h2>
      <section
        className={`${formSurface.dashboardPanel} space-y-3 p-3 sm:p-4`}
        aria-labelledby="validation-queue-filters-title"
      >
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className={`${formSurface.fieldGroup} min-w-0 text-sm`}>
            <span className={formSurface.label}>Situação da análise</span>
            <select
              className={formSurface.inputSelect}
              value={situation}
              onChange={(event) =>
                onSituationChange(event.target.value as QueueSituationFilter)
              }
            >
              {QUEUE_SITUATIONS.map((key) => (
                <option key={key} value={key}>
                  {QUEUE_SITUATION_FILTER_LABEL[key]}
                </option>
              ))}
            </select>
          </label>
          {sectionNavigation}
          <label className={`${formSurface.fieldGroup} min-w-0 text-sm`}>
            <span className={formSurface.label}>Busca</span>
            <input
              type="search"
              className={formSurface.input}
              value={search}
              placeholder="Pergunta, seção ou número"
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </label>
        </div>

        <div
          className={
            "flex flex-col gap-3 border-t border-slate-100 pt-3 " +
            "sm:flex-row sm:items-center sm:justify-between"
          }
        >
          <div className="min-w-0">{toolbarStart}</div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <a
              href={fullFormHref}
              className={`${formSurface.secondaryButtonSm} shrink-0`}
            >
              Visualizar formulário completo
            </a>
            {toolbarActions}
          </div>
        </div>
      </section>
    </div>
  );
}

/** Filtros da consulta do formulário completo (eixo/seção ficam na navegação). */
export function ValidationFullFormFilters({
  answer,
  situation,
  decision,
  proof,
  search,
  onAnswerChange,
  onSituationChange,
  onDecisionChange,
  onProofChange,
  onSearchChange,
}: {
  answer: FormAnswerFilter;
  situation: FormAnalysisSituation;
  decision: FormAdminDecisionFilter;
  proof: FormProofFilter;
  search: string;
  onAnswerChange: (value: FormAnswerFilter) => void;
  onSituationChange: (value: FormAnalysisSituation) => void;
  onDecisionChange: (value: FormAdminDecisionFilter) => void;
  onProofChange: (value: FormProofFilter) => void;
  onSearchChange: (value: string) => void;
}) {
  return (
    <div
      className={`${formSurface.dashboardPanel} grid gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3 xl:grid-cols-5`}
    >
      <label className={`${formSurface.fieldGroup} min-w-0 text-sm`}>
        <span className={formSurface.label}>Resposta do respondente</span>
        <select
          className={formSurface.inputSelect}
          value={answer}
          onChange={(event) =>
            onAnswerChange(event.target.value as FormAnswerFilter)
          }
        >
          {(Object.keys(FORM_ANSWER_FILTER_LABEL) as FormAnswerFilter[]).map(
            (key) => (
              <option key={key} value={key}>
                {FORM_ANSWER_FILTER_LABEL[key]}
              </option>
            ),
          )}
        </select>
      </label>

      <label className={`${formSurface.fieldGroup} min-w-0 text-sm`}>
        <span className={formSurface.label}>Situação da análise</span>
        <select
          className={formSurface.inputSelect}
          value={situation}
          onChange={(event) =>
            onSituationChange(event.target.value as FormAnalysisSituation)
          }
        >
          {(
            Object.keys(FORM_ANALYSIS_SITUATION_LABEL) as FormAnalysisSituation[]
          ).map((key) => (
            <option key={key} value={key}>
              {FORM_ANALYSIS_SITUATION_LABEL[key]}
            </option>
          ))}
        </select>
      </label>

      <label className={`${formSurface.fieldGroup} min-w-0 text-sm`}>
        <span className={formSurface.label}>Decisão administrativa</span>
        <select
          className={formSurface.inputSelect}
          value={decision}
          onChange={(event) =>
            onDecisionChange(event.target.value as FormAdminDecisionFilter)
          }
        >
          {(
            Object.keys(
              FORM_ADMIN_DECISION_FILTER_LABEL,
            ) as FormAdminDecisionFilter[]
          ).map((key) => (
            <option key={key} value={key}>
              {FORM_ADMIN_DECISION_FILTER_LABEL[key]}
            </option>
          ))}
        </select>
      </label>

      <label className={`${formSurface.fieldGroup} min-w-0 text-sm`}>
        <span className={formSurface.label}>Comprovação</span>
        <select
          className={formSurface.inputSelect}
          value={proof}
          onChange={(event) =>
            onProofChange(event.target.value as FormProofFilter)
          }
        >
          {(Object.keys(FORM_PROOF_FILTER_LABEL) as FormProofFilter[]).map(
            (key) => (
              <option key={key} value={key}>
                {FORM_PROOF_FILTER_LABEL[key]}
              </option>
            ),
          )}
        </select>
      </label>

      <label className={`${formSurface.fieldGroup} min-w-0 text-sm`}>
        <span className={formSurface.label}>Busca</span>
        <input
          type="search"
          className={formSurface.input}
          value={search}
          placeholder="Pergunta ou número"
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>
    </div>
  );
}
