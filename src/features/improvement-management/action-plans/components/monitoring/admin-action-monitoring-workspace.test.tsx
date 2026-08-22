// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminActionPlanSupervisionWorkspace } from "../admin/admin-action-plan-supervision-workspace";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/plano-acao/rec-1/monitoramento",
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock(
  "@/features/improvement-management/recommendations/components/hub/recommendation-detail-context",
  () => ({
    useRecommendationDetailContext: () => ({
      role: "admin",
      recommendationId: "rec-1",
      listPath: "/admin/plano-acao",
      detailBasePath: "/admin/plano-acao/rec-1",
      actionsTabHrefSegment: "acoes",
      refetch: vi.fn(async () => undefined),
      row: {
        recommendationId: "rec-1",
        questionId: "q-1",
        cycleId: "cycle-1",
        cycleState: "validated",
        formId: "form-1",
        formName: "Formulário",
        formVersion: 1,
        organizationId: "org-1",
        organizationName: "Órgão",
        questionPrompt: "Pergunta",
        sectionId: "sec-1",
        sectionName: "Seção",
        sectionOrder: 1,
        questionOrder: 1,
        axisName: "Governança",
        recommendationType: "nao_implementacao",
        recommendationText: "Recomendação",
        recommendationStatus: "in_action_plan",
        plans: [
          {
            id: "plan-1",
            actionText: "Publicar informações no portal institucional",
            startDate: "2026-04-01",
            dueDate: "2026-09-30",
            responsibleSector: "Unidade X",
            responsibleUserId: "user-1",
            responsibleName: "Unidade X",
            progressPercentage: 45,
            status: "in_progress",
            observations: null,
            updatedAt: "2026-08-12",
            revision: 1,
            documents: [],
            slaLabel: "ok",
          },
        ],
        slaLabel: "ok",
      },
      adminItem: { planId: "plan-1" },
    }),
  }),
);

vi.mock(
  "@/features/improvement-management/action-plans/components/monitoring/use-action-monitoring-workspace",
  () => ({
  useActionMonitoringWorkspace: () => ({
    pendingItems: [],
    progressUpdates: [],
    operationalLoading: false,
    operationalError: null,
    retryOperational: vi.fn(),
    openRequestActionIds: new Set(),
    prependNote: vi.fn(),
    replaceNote: vi.fn(),
    replaceDeadline: vi.fn(),
    refreshOpenRequests: vi.fn(async () => undefined),
    auditFeedItems: [],
    auditLoading: false,
    auditError: null,
    auditTotal: 0,
    auditOffset: 0,
    auditHasMore: false,
    auditPageSize: 20,
    retryAudit: vi.fn(),
    previousAuditPage: vi.fn(),
    nextAuditPage: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
});

describe("AdminActionPlanSupervisionWorkspace", () => {
  it("organiza a página como área de trabalho da ação, com o histórico em tabela", () => {
    render(<AdminActionPlanSupervisionWorkspace />);

    const headings = screen.getAllByRole("heading").map((heading) => heading.textContent);
    expect(headings).toEqual([
      "Árvore de problemas e soluções",
      "Ação monitorada",
      "Acompanhamento",
      "Pendências e decisões",
      "Histórico da ação",
      "Comprovações da execução",
    ]);

    expect(screen.queryByRole("heading", { name: "Situação atual" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Histórico de acompanhamento" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Evidências vinculadas" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Auditoria detalhada" })).toBeNull();
    expect(screen.queryByText("Registros oficiais da supervisão")).toBeNull();
    expect(screen.queryByText("Contexto recente")).toBeNull();
    expect(screen.getByRole("button", { name: "Registrar acompanhamento" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ver auditoria da ação" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver detalhes da ação" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Consultar comprovações" })).toBeTruthy();
  });
});
