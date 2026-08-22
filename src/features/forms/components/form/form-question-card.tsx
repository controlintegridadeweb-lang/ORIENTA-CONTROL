"use client";

import { ChevronDown, ChevronUp, Paperclip, Pencil, ShieldOff } from "lucide-react";
import { Spinner } from "@/shared/ui/components/loading";
import { FormAllowsNotApplicableField } from "@/features/forms/components/form/form-allows-not-applicable-field";
import { FormEvidenceRequirementField } from "@/features/forms/components/form/form-evidence-requirement-field";
import type { OrgOption } from "@/features/forms/components/form/waiver-editor-modal";
import { validateConfigurationForPublish } from "@/features/library";
import { bindingHasRecommendation } from "@/features/library";
import type { QuestionLibraryConfiguration } from "@/features/library";
import type { LibraryAxis, LibrarySection } from "@/features/library";
import type { QuestionRow } from "@/features/forms/admin-service";
import { typography } from "@/shared/layout/design-system";
import { formSurface } from "@/shared/layout/form-surface";
import {
  RECOMMENDATION_TEXT_MAX,
  sectionLabel,
  type WaiversByQuestion,
} from "./form-questions-configurator-helpers";

type FormQuestionCardProps = {
  question: QuestionRow;
  index: number;
  total: number;
  isOpen: boolean;
  isBusy: boolean;
  editing: boolean;
  draft: string;
  configuration: QuestionLibraryConfiguration | undefined;
  isLoaded: boolean;
  isLoading: boolean;
  hasLoadError: boolean;
  savingConfig: boolean;
  catalog: { axes: LibraryAxis[]; sections: LibrarySection[] } | null;
  organizations: OrgOption[];
  waiversByQuestion: WaiversByQuestion;
  orgsLoading: boolean;
  onToggleOpen: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDraftChange: (value: string) => void;
  onCancelEdit: () => void;
  onSavePrompt: () => void;
  onStartEdit: () => void;
  onRemove: () => void;
  onToggleEvidence: (checked: boolean) => void;
  onToggleAllowsNotApplicable: (checked: boolean) => void;
  onSectionChange: (sectionId: string) => void;
  onRecommendationChange: (textoBaseFixo: string) => void;
  onRetryConfiguration: () => void;
  onSaveConfiguration: () => void;
  onOpenWaiverEditor: () => void;
};

export function FormQuestionCard({
  question: q,
  index,
  total,
  isOpen,
  isBusy,
  editing,
  draft,
  configuration,
  isLoaded,
  isLoading,
  hasLoadError,
  savingConfig,
  catalog,
  organizations,
  waiversByQuestion,
  orgsLoading,
  onToggleOpen,
  onMoveUp,
  onMoveDown,
  onDraftChange,
  onCancelEdit,
  onSavePrompt,
  onStartEdit,
  onRemove,
  onToggleEvidence,
  onToggleAllowsNotApplicable,
  onSectionChange,
  onRecommendationChange,
  onRetryConfiguration,
  onSaveConfiguration,
  onOpenWaiverEditor,
}: FormQuestionCardProps) {
  const publishCheck = configuration
    ? validateConfigurationForPublish(configuration)
    : { valid: false, missing: ["defaultRecommendation"] };
  const configurationStatus = !configuration
    ? "Aguardando configuração"
    : publishCheck.valid && Boolean(configuration.sectionId)
      ? "Configuração concluída"
      : "Configuração pendente";
  const pendingItems = [
    !configuration?.sectionId ? "seção da biblioteca" : null,
    ...publishCheck.missing.map((item) =>
      item === "defaultRecommendation" ? "recomendação-base" : "configuração da pergunta",
    ),
  ].filter((item): item is string => Boolean(item));

  const waived = waiversByQuestion.get(q.id);
  const waivedOrgIds = waived ? [...waived.keys()] : [];
  const waivedNames = waivedOrgIds
    .map((id) => organizations.find((o) => o.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  return (
    <li
      data-testid="question-binding"
      data-question-id={q.id}
      className="rounded-xl border border-slate-200/90 bg-white shadow-card"
    >
      <div className="flex items-start gap-2 px-4 py-3 sm:px-5">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={onToggleOpen}
          className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left"
        >
          <span className="min-w-0">
            <span className={typography.meta}>Pergunta {index + 1}</span>
            <span className="mt-1 block text-sm font-medium leading-relaxed text-slate-900">
              {q.prompt}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2 pt-0.5">
            <span className="hidden text-xs text-slate-500 sm:inline">
              {isLoading
                ? "Carregando…"
                : hasLoadError
                  ? "Falha ao carregar"
                  : configurationStatus}
            </span>
            <ChevronDown
              className={`h-4 w-4 text-slate-400 transition ${isOpen ? "rotate-180" : ""}`}
              aria-hidden
            />
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1 pt-1">
          <button
            type="button"
            disabled={index === 0 || isBusy}
            onClick={onMoveUp}
            title="Mover para cima"
            aria-label="Mover pergunta para cima"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronUp className="h-4 w-4" strokeWidth={2.25} />
          </button>
          <button
            type="button"
            disabled={index === total - 1 || isBusy}
            onClick={onMoveDown}
            title="Mover para baixo"
            aria-label="Mover pergunta para baixo"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronDown className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>
      </div>

      {isOpen ? (
        <div className="space-y-6 border-t border-slate-100 px-4 py-4 sm:px-5">
          <section className="space-y-3">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Enunciado e evidência
            </h5>
            {editing ? (
              <div className={formSurface.fieldGroup}>
                <label htmlFor={`edit-prompt-${q.id}`} className="text-sm font-medium text-slate-800">
                  Enunciado
                </label>
                <textarea
                  id={`edit-prompt-${q.id}`}
                  autoFocus
                  value={draft}
                  onChange={(e) => onDraftChange(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className={`${formSurface.inputTextarea} min-h-19`}
                />
              </div>
            ) : q.requiresEvidence ? (
              <p className="flex items-start gap-2 text-xs leading-snug text-slate-600">
                <Paperclip className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                <span>Esta pergunta exige comprovante quando a resposta for Sim.</span>
              </p>
            ) : null}

            <FormEvidenceRequirementField
              id={`evidence-${q.id}`}
              checked={q.requiresEvidence}
              disabled={isBusy}
              onChange={onToggleEvidence}
            />

            <FormAllowsNotApplicableField
              id={`allows-na-${q.id}`}
              checked={q.allowsNotApplicable}
              disabled={isBusy}
              onChange={onToggleAllowsNotApplicable}
            />

            <div className="flex flex-wrap items-center justify-end gap-2">
              {editing ? (
                <>
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    disabled={isBusy}
                    className={formSurface.secondaryButtonSm}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={onSavePrompt}
                    className={formSurface.primaryButtonSm}
                  >
                    {isBusy ? "Salvando…" : "Salvar enunciado"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={onRemove}
                    className={formSurface.dangerButton}
                  >
                    Remover
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={onStartEdit}
                    className={formSurface.secondaryButtonSm}
                  >
                    Editar enunciado
                  </button>
                </>
              )}
            </div>
          </section>

          <section className="space-y-3 border-t border-slate-100 pt-5">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Configuração
            </h5>
            {hasLoadError ? (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-3">
                <p className="text-sm text-red-700">
                  Não foi possível carregar a configuração. Nenhum valor padrão foi aplicado.
                </p>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={onRetryConfiguration}
                  className={formSurface.secondaryButtonSm}
                >
                  {isLoading ? "Tentando novamente…" : "Tentar novamente"}
                </button>
              </div>
            ) : isLoading || !isLoaded || !configuration ? (
              <p className="text-sm text-slate-500">Carregando configuração…</p>
            ) : (
              <>
                <label className="block text-xs font-medium text-slate-700">
                  Seção da biblioteca
                  <span className="mt-0.5 block text-xs font-normal leading-relaxed text-slate-500">
                    A seção já pertence a um eixo ESG e organiza esta pergunta na biblioteca.
                  </span>
                  <select
                    className={`mt-1 ${formSurface.input}`}
                    value={configuration.sectionId}
                    onChange={(e) => onSectionChange(e.target.value)}
                  >
                    <option value="">Selecione a seção…</option>
                    {(catalog?.sections ?? []).map((section) => (
                      <option key={section.id} value={section.id}>
                        {sectionLabel(section, catalog?.axes ?? [])}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  <p className="font-medium">Resposta</p>
                  <p className="mt-0.5 text-slate-600">Sim, Não ou Não se aplica.</p>
                </div>

                <label className="block text-xs font-medium text-slate-700">
                  Recomendação-base
                  <span className="mt-0.5 block text-xs font-normal leading-relaxed text-slate-500">
                    Gerada quando a resposta for Não ou quando a evidência não for aprovada.
                  </span>
                  <textarea
                    className={`mt-1 ${formSurface.inputTextarea}`}
                    rows={4}
                    maxLength={RECOMMENDATION_TEXT_MAX}
                    value={configuration.bindings.defaultRecommendation?.textoBaseFixo ?? ""}
                    onChange={(e) => onRecommendationChange(e.target.value)}
                  />
                </label>

                {!publishCheck.valid ? (
                  <p className="text-xs text-amber-700">
                    Falta configurar: {pendingItems.join(", ")}.
                  </p>
                ) : null}
                {bindingHasRecommendation(configuration.bindings) ? (
                  <p className="text-xs text-emerald-700">Recomendação-base configurada.</p>
                ) : null}

                <button
                  type="button"
                  disabled={savingConfig}
                  className={formSurface.primaryButton}
                  onClick={onSaveConfiguration}
                >
                  {savingConfig ? "Salvando…" : "Salvar configuração"}
                </button>
              </>
            )}
          </section>

          <section className="space-y-3 border-t border-slate-100 pt-5">
            <div>
              <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Aplicabilidade por organização
              </h5>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Regra <strong className="font-semibold text-slate-800">permanente</strong> da
                pergunta: vale em todos os formulários que a incluírem. É diferente de “Não se
                aplica neste diagnóstico”, escolhida pelo respondente na execução.
              </p>
            </div>

            {orgsLoading ? (
              <p className="inline-flex items-center gap-2 text-sm text-slate-500">
                <Spinner size="sm" /> Carregando aplicabilidade…
              </p>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                {waivedNames.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {waivedNames.map((name) => (
                      <span
                        key={name}
                        className={`${formSurface.badge.base} ${formSurface.badge.neutral}`}
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Aplicável a todas as organizações.</p>
                )}
                <button
                  type="button"
                  onClick={onOpenWaiverEditor}
                  className={`inline-flex shrink-0 items-center gap-1.5 ${formSurface.secondaryButtonSm}`}
                >
                  {waivedOrgIds.length > 0 ? (
                    <>
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                      Editar ({waivedOrgIds.length})
                    </>
                  ) : (
                    <>
                      <ShieldOff className="h-3.5 w-3.5" aria-hidden />
                      Definir aplicabilidade
                    </>
                  )}
                </button>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </li>
  );
}
