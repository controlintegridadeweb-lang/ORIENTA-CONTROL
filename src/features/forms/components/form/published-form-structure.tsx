"use client";

import { useCallback, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import { FormTabPanel } from "@/features/forms/components/form/form-tab-panel";
import { formManagementUi } from "@/features/forms/components/form/form-management-ui";
import { PaginationControls } from "@/shared/ui/components/pagination-controls";
import { buildPageNumbers } from "@/shared/hooks/use-pagination";
import {
  DEFAULT_PUBLISHED_STRUCTURE_PAGE_SIZE,
  paginatePublishedQuestions,
  parsePublishedStructurePage,
  type PublishedStructureAxisGroup,
} from "@/features/forms/published-structure-groups";
import type {
  PublishedFormQuestion,
  PublishedFormStructure,
} from "@/features/forms/published-structure-types";
import { CriterionScore } from "@/features/forms/components/criterion-score";
import { formSurface } from "@/shared/layout/form-surface";

function formatPublishedAt(value: string | null): string {
  return formatPlatformDateTime(
    value,
    { dateStyle: "long", timeStyle: "short" },
    "Data de publicação não registrada",
  );
}

function PublishedStructureQuestionCard({ question }: { question: PublishedFormQuestion }) {
  return (
    <li className="border-t border-slate-100 py-4 first:border-t-0 first:pt-0">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
          {question.orderIndex + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <p className={`${formManagementUi.subsectionTitle} leading-relaxed`}>{question.prompt}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`${formSurface.badge.base} ${formSurface.badge.neutral}`}>
              {question.evidenceRequired ? "Exige evidência" : "Evidência opcional"}
            </span>
            {question.famiEnabled ? (
              <CriterionScore
                answer={null}
                requiresEvidence={question.evidenceRequired}
                famiEnabled
              />
            ) : (
              <span className={`${formSurface.badge.base} ${formSurface.badge.neutral}`}>
                Não compõe o FAMI
              </span>
            )}
          </div>
          {question.metricDescription || question.metricName ? (
            <div className="space-y-1">
              <p className={formManagementUi.muted}>Métrica analítica</p>
              <p className="text-sm text-slate-700">
                {question.metricDescription ?? question.metricName}
              </p>
            </div>
          ) : null}
          <div className="space-y-1">
            <p className={formManagementUi.muted}>Recomendação-base</p>
            {question.recommendation ? (
              <div className="space-y-1 text-sm text-slate-700">
                <p className="font-medium text-slate-800">{question.recommendation.title}</p>
                {question.recommendation.textoBaseFixo ? (
                  <p>{question.recommendation.textoBaseFixo}</p>
                ) : null}
                {question.recommendation.description ? (
                  <p>{question.recommendation.description}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-amber-700">
                Snapshot editorial não disponível nesta versão.
              </p>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function PublishedStructureList({ groups }: { groups: PublishedStructureAxisGroup[] }) {
  return (
    <div className="space-y-8">
      {groups.map((axis) => (
        <section key={axis.axisName} className="space-y-4" aria-labelledby={`axis-${axis.axisName}`}>
          <h3 id={`axis-${axis.axisName}`} className={formManagementUi.sectionTitle}>
            {axis.axisName}
          </h3>
          {axis.sections.map((section) => (
            <div
              key={`${axis.axisName}-${section.sectionName}`}
              className={`${formManagementUi.surface} p-4 sm:p-5`}
            >
              <h4 className={formManagementUi.subsectionTitle}>{section.sectionName}</h4>
              <ol className="mt-3">
                {section.questions.map((question) => (
                  <PublishedStructureQuestionCard key={question.questionId} question={question} />
                ))}
              </ol>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function PublishedStructurePaginationBar({
  page,
  totalItems,
  totalPages,
  rangeStart,
  rangeEnd,
  onPageChange,
}: {
  page: number;
  totalItems: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const noun = totalItems === 1 ? "pergunta" : "perguntas";
  const summary = (
    <p aria-live="polite" className="tabular-nums text-slate-600">
      <span className="sm:hidden">
        Página <span className="font-semibold text-slate-800">{page}</span> de{" "}
        <span className="font-semibold text-slate-800">{totalPages}</span>
      </span>
      <span className="hidden sm:inline">
        Exibindo{" "}
        <span className="font-semibold text-slate-800">
          {rangeStart}–{rangeEnd}
        </span>{" "}
        de <span className="font-semibold text-slate-800">{totalItems}</span> {noun}
        {" · "}
        Página <span className="font-semibold text-slate-800">{page}</span> de{" "}
        <span className="font-semibold text-slate-800">{totalPages}</span>
      </span>
    </p>
  );

  return (
    <PaginationControls
      page={page}
      totalPages={totalPages}
      pageNumbers={buildPageNumbers(page, totalPages)}
      onPageChange={onPageChange}
      summary={summary}
      variant="default"
      className="!mt-0"
      aria-label="Paginação da estrutura publicada"
      compactMobile
    />
  );
}

export function PublishedFormStructureView({
  structure,
}: {
  structure: PublishedFormStructure;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const listRef = useRef<HTMLDivElement>(null);

  const requestedPage = parsePublishedStructurePage(searchParams.get("page"));

  const paginated = useMemo(
    () =>
      paginatePublishedQuestions(
        structure.questions,
        requestedPage,
        DEFAULT_PUBLISHED_STRUCTURE_PAGE_SIZE,
      ),
    [structure.questions, requestedPage],
  );

  const replacePage = useCallback(
    (nextPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("pageSize");
      if (nextPage <= 1) params.delete("page");
      else params.set("page", String(nextPage));
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const scrollToListStart = useCallback(() => {
    const node = listRef.current;
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      replacePage(nextPage);
      scrollToListStart();
    },
    [replacePage, scrollToListStart],
  );

  const totalQuestions = structure.questions.length;

  return (
    <FormTabPanel
      title="Estrutura publicada"
      description={`Versão ${structure.version} · ${totalQuestions} pergunta(s) · ${formatPublishedAt(structure.publishedAt)}. Conteúdo somente para consulta.`}
    >
      {totalQuestions === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-500">
          A versão publicada não contém perguntas.
        </p>
      ) : (
        <div className="space-y-6">
          <div ref={listRef} tabIndex={-1} className="scroll-mt-4 outline-none">
            <PublishedStructureList groups={paginated.groups} />
          </div>

          <PublishedStructurePaginationBar
            page={paginated.safePage}
            totalItems={paginated.totalItems}
            totalPages={paginated.totalPages}
            rangeStart={paginated.rangeStart}
            rangeEnd={paginated.rangeEnd}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </FormTabPanel>
  );
}
