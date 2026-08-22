"use client";

import { typography } from "@/shared/layout/design-system";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/shared/ui/components/page-header";
import type { UnifiedFormCriterion } from "@/features/validation";
import type { QueueSectionSummary } from "@/features/validation/queue-model";
import {
  ALL_AXES_PARAM,
  ALL_SECTIONS_PARAM,
  buildSectionNavigation,
  compareSectionCatalogOrder,
  pickPreferredSectionIdForAxis,
  resolveSelectedAxisId,
  resolveSelectedSectionId,
  sectionsForAxis,
} from "@/features/validation/queue-model";
import {
  formAdminDecisionFilterToParam,
  formAnalysisSituationToParam,
  formAnswerFilterToParam,
  formProofFilterToParam,
  type FormAdminDecisionFilter,
  type FormAnalysisSituation,
  type FormAnswerFilter,
  type FormProofFilter,
  type FormViewSummary,
} from "@/features/validation/form-view-model";
import {
  clampValidationPage,
  DEFAULT_VALIDATION_PAGE_SIZE,
  parseValidationPage,
  parseValidationPageSize,
  type ValidationPageSize,
} from "@/features/validation/pagination";
import { ValidationFormSummary } from "./ValidationFormSummary";
import { ValidationFullFormFilters } from "./ValidationFormFilters";
import { ValidationSectionNavigation } from "./ValidationSectionNavigation";
import { ValidationQueuePagination } from "./ValidationQueuePagination";
import { ReadonlyCriterionCard } from "./ReadonlyCriterionCard";
import { formSurface } from "@/shared/layout/form-surface";
import { countLabel } from "@/shared/format/count-label";

function CycleContext({
  organizationName,
  formName,
  periodLabel,
}: {
  organizationName: string;
  formName: string;
  periodLabel: string;
}) {
  return (
    <dl className="-mt-2 mb-1 grid gap-3 border-b border-slate-200 pb-5 text-sm text-slate-500 sm:-mt-4 sm:mb-2 sm:grid-cols-3 sm:pb-6">
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Organização
        </dt>
        <dd className="mt-0.5 text-slate-700">{organizationName}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Diagnóstico
        </dt>
        <dd className="mt-0.5 text-slate-700">{formName}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Período
        </dt>
        <dd className="mt-0.5 text-slate-700">{periodLabel}</dd>
      </div>
    </dl>
  );
}

/**
 * Consulta do formulário completo — não é fila de trabalho.
 * Exibe todas as respostas sem transformar itens em pendências.
 */
export function ValidationFullFormView({
  cycleId,
  organizationName,
  formName,
  periodLabel,
  returnTo,
  filaReturnQuery,
  initialCriteria,
  formSummary,
  formSections,
  pagination,
}: {
  cycleId: string;
  organizationName: string;
  formName: string;
  periodLabel: string;
  returnTo?: string | null;
  filaReturnQuery: string;
  initialCriteria: UnifiedFormCriterion[];
  formSummary: FormViewSummary;
  formSections: QueueSectionSummary[];
  pagination: {
    page: number;
    pageSize: ValidationPageSize;
    totalItems: number;
    sectionId: string | null;
    axisId: string | null;
    answer: FormAnswerFilter;
    situation: FormAnalysisSituation;
    decision: FormAdminDecisionFilter;
    proof: FormProofFilter;
    search: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchDraft, setSearchDraft] = useState(pagination.search);
  const [seenSearch, setSeenSearch] = useState(pagination.search);

  if (seenSearch !== pagination.search) {
    setSeenSearch(pagination.search);
    setSearchDraft(pagination.search);
  }

  const page = parseValidationPage(
    searchParams.get("pagina") ?? String(pagination.page),
  );
  const pageSize = parseValidationPageSize(
    searchParams.get("porPagina") ?? String(pagination.pageSize),
  );
  const totalItems = pagination.totalItems;
  const sectionNav = useMemo(
    () =>
      buildSectionNavigation(
        [...formSections]
          .sort(compareSectionCatalogOrder)
          .flatMap((section) =>
            Array.from(
              { length: Math.max(section.totalCount, 1) },
              (_, index) => ({
                sectionId: section.id,
                sectionName: section.title,
                sectionOrder: section.sectionOrder,
                axisId: section.axisId,
                axisName: section.axisName,
                status: index < section.pendingCount ? "pending" : "approved",
              }),
            ),
          ),
      ),
    [formSections],
  );

  const selectedSectionId = resolveSelectedSectionId(
    searchParams.get("secao") ?? pagination.sectionId,
    formSections,
  );
  const axisFromUrl = searchParams.get("eixo") ?? pagination.axisId;
  const axisFromSection =
    selectedSectionId !== ALL_SECTIONS_PARAM
      ? formSections.find((section) => section.id === selectedSectionId)
          ?.axisId ?? null
      : null;
  const selectedAxisId = resolveSelectedAxisId(
    axisFromUrl ?? axisFromSection,
    sectionNav.groups,
  );

  const queueHref = useMemo(() => {
    const params = new URLSearchParams(filaReturnQuery);
    if (returnTo && !params.has("returnTo")) {
      params.set("returnTo", returnTo);
    }
    const qs = params.toString();
    return `/admin/ciclos/${cycleId}/validacao${qs ? `?${qs}` : ""}`;
  }, [cycleId, filaReturnQuery, returnTo]);

  function replaceParams(next: {
    sectionId?: string | null;
    axisId?: string | null;
    answer?: FormAnswerFilter;
    situation?: FormAnalysisSituation;
    decision?: FormAdminDecisionFilter;
    proof?: FormProofFilter;
    search?: string;
    page?: number;
    pageSize?: ValidationPageSize;
    resetPage?: boolean;
  }) {
    const params = new URLSearchParams(searchParams.toString());

    const axisValue =
      next.axisId === undefined
        ? selectedAxisId === ALL_AXES_PARAM
          ? null
          : selectedAxisId
        : next.axisId;
    if (axisValue) params.set("eixo", axisValue);
    else params.delete("eixo");

    let sectionValue =
      next.sectionId === undefined
        ? selectedSectionId
        : (next.sectionId ?? ALL_SECTIONS_PARAM);

    if (next.axisId !== undefined) {
      const axisSections = sectionsForAxis(formSections, axisValue);
      if (
        sectionValue &&
        sectionValue !== ALL_SECTIONS_PARAM &&
        !axisSections.some((section) => section.id === sectionValue)
      ) {
        sectionValue =
          pickPreferredSectionIdForAxis(axisSections) ?? ALL_SECTIONS_PARAM;
      }
    }

    if (!sectionValue || sectionValue === ALL_SECTIONS_PARAM) {
      params.delete("secao");
    } else {
      params.set("secao", sectionValue);
    }

    const answer = next.answer ?? pagination.answer;
    const answerParam = formAnswerFilterToParam(answer);
    if (answerParam) params.set("resposta", answerParam);
    else params.delete("resposta");

    const situation = next.situation ?? pagination.situation;
    const situationParam = formAnalysisSituationToParam(situation);
    if (situationParam) params.set("situacao", situationParam);
    else params.delete("situacao");

    const decision = next.decision ?? pagination.decision;
    const decisionParam = formAdminDecisionFilterToParam(decision);
    if (decisionParam) params.set("decisao", decisionParam);
    else params.delete("decisao");

    const proof = next.proof ?? pagination.proof;
    const proofParam = formProofFilterToParam(proof);
    if (proofParam) params.set("comprovacao", proofParam);
    else params.delete("comprovacao");

    const search = next.search ?? pagination.search;
    if (search.trim()) params.set("busca", search.trim());
    else params.delete("busca");

    const nextPage = next.resetPage ? 1 : (next.page ?? page);
    const nextPageSize = next.pageSize ?? pageSize;
    if (nextPage > 1) params.set("pagina", String(nextPage));
    else params.delete("pagina");
    if (nextPageSize !== DEFAULT_VALIDATION_PAGE_SIZE) {
      params.set("porPagina", String(nextPageSize));
    } else {
      params.delete("porPagina");
    }

    if (filaReturnQuery) params.set("fila", filaReturnQuery);
    if (returnTo) params.set("returnTo", returnTo);

    router.replace(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (searchDraft.trim() === pagination.search.trim()) return;
      replaceParams({ search: searchDraft, resetPage: true });
    }, 400);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  const safePage = clampValidationPage(page, totalItems, pageSize);
  const selectedSection =
    selectedSectionId === ALL_SECTIONS_PARAM
      ? null
      : (formSections.find((section) => section.id === selectedSectionId) ??
        null);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Formulário completo"
        description="Consulta de todas as respostas do diagnóstico. Esta tela não é a fila de trabalho."
      />
      <CycleContext
        organizationName={organizationName}
        formName={formName}
        periodLabel={periodLabel}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={queueHref} className={formSurface.secondaryButtonSm}>
          ← Voltar à fila de validação
        </Link>
        <p className="text-sm text-slate-500">
          Visualização de consulta — decisões são feitas na fila.
        </p>
      </div>

      <ValidationFormSummary summary={formSummary} />

      <ValidationFullFormFilters
        answer={pagination.answer}
        situation={pagination.situation}
        decision={pagination.decision}
        proof={pagination.proof}
        search={searchDraft}
        onAnswerChange={(value) =>
          replaceParams({ answer: value, resetPage: true })
        }
        onSituationChange={(value) =>
          replaceParams({ situation: value, resetPage: true })
        }
        onDecisionChange={(value) =>
          replaceParams({ decision: value, resetPage: true })
        }
        onProofChange={(value) =>
          replaceParams({ proof: value, resetPage: true })
        }
        onSearchChange={setSearchDraft}
      />

      <div className="min-w-0 space-y-4">
        <ValidationSectionNavigation
          groups={sectionNav.groups}
          sections={sectionNav.sections}
          totalPending={sectionNav.totalPending}
          totalCount={sectionNav.total}
          selectedAxisId={selectedAxisId}
          selectedSectionId={selectedSectionId}
          onSelectAxis={(axisId) =>
            replaceParams({
              axisId,
              resetPage: true,
            })
          }
          onSelect={(sectionId) =>
            replaceParams({
              sectionId:
                sectionId === ALL_SECTIONS_PARAM ? null : sectionId,
              resetPage: true,
            })
          }
        />

        <div className="space-y-2">
          <h2 className={typography.sectionTitle}>
            {selectedSection ? selectedSection.title : "Todas as seções"}
          </h2>
          <p className="text-sm text-slate-500">
            {selectedSection ? `${selectedSection.axisName} · ` : ""}
            {countLabel(
              totalItems,
              "critério nesta consulta",
              "critérios nesta consulta",
            )}
          </p>
        </div>

        {initialCriteria.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500">
            Nenhum critério corresponde aos filtros selecionados.
          </p>
        ) : (
          <ul className="space-y-4">
            {initialCriteria.map((criterion) => (
              <li key={criterion.responseId}>
                <div className="mb-2 px-1 text-xs font-semibold tabular-nums text-slate-500">
                  Critério {criterion.orderIndex + 1} ·{" "}
                  {criterion.visualStatusLabel}
                </div>
                <ReadonlyCriterionCard
                  criterion={criterion}
                  showSectionContext={
                    selectedSectionId === ALL_SECTIONS_PARAM
                  }
                />
              </li>
            ))}
          </ul>
        )}

        <ValidationQueuePagination
          page={safePage}
          pageSize={pageSize}
          totalItems={totalItems}
          pageItemCount={initialCriteria.length}
          onPageChange={(nextPage) => replaceParams({ page: nextPage })}
        />
      </div>
    </div>
  );
}
