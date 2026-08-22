"use client";

import { useCallback, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AnswersSummary, AnswersSummaryQuestion } from "@/features/forms/answers-types";
import { formManagementUi } from "@/features/forms/components/form/form-management-ui";
import { PaginationControls } from "@/shared/ui/components/pagination-controls";
import { buildPageNumbers } from "@/shared/hooks/use-pagination";
import { AnswersSummaryQuestionCard } from "./answers-summary-question-card";

export const DEFAULT_ANSWERS_SUMMARY_PAGE_SIZE = 10;

export function parseAnswersSummaryPage(value: string | null | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function paginateAnswersSummaryQuestions(
  questions: readonly AnswersSummaryQuestion[],
  page: number,
  pageSize: number = DEFAULT_ANSWERS_SUMMARY_PAGE_SIZE,
) {
  const totalItems = questions.length;
  const safePageSize = Math.max(1, Math.trunc(pageSize));
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize) || 1);
  const safePage = Math.min(Math.max(1, Math.trunc(page)), totalPages);
  const startIndex = (safePage - 1) * safePageSize;
  const pageQuestions = questions.slice(startIndex, startIndex + safePageSize);
  const pageItemCount = pageQuestions.length;

  return {
    pageQuestions,
    totalItems,
    totalPages,
    safePage,
    rangeStart: pageItemCount === 0 ? 0 : startIndex + 1,
    rangeEnd: startIndex + pageItemCount,
  };
}

function AnswersSummaryPaginationBar({
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
      aria-label="Paginação do resumo de respostas"
      compactMobile
    />
  );
}

export function AnswersSummaryView({ summary }: { summary: AnswersSummary }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const listRef = useRef<HTMLDivElement>(null);

  const requestedPage = parseAnswersSummaryPage(searchParams.get("page"));

  const paginated = useMemo(
    () => paginateAnswersSummaryQuestions(summary.questions, requestedPage),
    [summary.questions, requestedPage],
  );

  const replacePage = useCallback(
    (nextPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
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

  if (summary.questions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center">
        <p className={formManagementUi.subsectionTitle}>Nenhuma pergunta configurada</p>
        <p className={`mt-1 ${formManagementUi.muted}`}>
          Cadastre perguntas e conclua suas configurações no formulário para acompanhar o
          resumo das respostas aqui.
        </p>
      </div>
    );
  }

  if (summary.totalRespondents === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center">
        <p className={formManagementUi.subsectionTitle}>Sem respostas ainda</p>
        <p className={`mt-1 ${formManagementUi.muted}`}>
          Quando alguma organização começar a responder, o resumo agregado e os gráficos
          aparecerão aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div ref={listRef} tabIndex={-1} className="scroll-mt-4 space-y-4 outline-none">
        {paginated.pageQuestions.map((q) => (
          <AnswersSummaryQuestionCard key={q.questionId} question={q} />
        ))}
      </div>

      <AnswersSummaryPaginationBar
        page={paginated.safePage}
        totalItems={paginated.totalItems}
        totalPages={paginated.totalPages}
        rangeStart={paginated.rangeStart}
        rangeEnd={paginated.rangeEnd}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
