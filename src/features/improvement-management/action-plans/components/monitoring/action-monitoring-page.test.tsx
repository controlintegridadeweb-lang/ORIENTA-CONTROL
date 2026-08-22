// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import { ActionMonitoringSummary } from "./action-monitoring-summary";
import { PendingDecisionsSection } from "./pending-decisions-section";
import { MonitoringComposer } from "./monitoring-composer";
import { RecentActivitySection } from "./recent-activity-section";
import { AuditHistorySection } from "./audit-history-section";
import { ExecutionProofsSection } from "./execution-proofs-section";
import { ConfirmProvider } from "@/shared/ui/components/confirm-dialog";
import {
  actionPanelFromSearchParams,
  actionWorkspaceHref,
  resolveMonitoredActionId,
} from "@/features/improvement-management/action-plans/action-workspace-href";

vi.mock("@/features/improvement-management/action-plans/client", () => ({
  createSupervisionNote: vi.fn(),
  decideAdminDeadlineChange: vi.fn(),
  decideSupervisionRequest: vi.fn(),
  respondToSupervisionRequest: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

function plan(over: Partial<ActionPlanAction> = {}): ActionPlanAction {
  return {
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
    ...over,
  };
}

describe("navegação da ação monitorada", () => {
  it("mantém o monitoramento e o detalhe da ação no mesmo action_id", () => {
    expect(resolveMonitoredActionId(["plan-1", "plan-2"], "plan-2")).toBe("plan-2");
    expect(resolveMonitoredActionId(["plan-1", "plan-2"], "missing")).toBe("plan-1");
    expect(
      actionWorkspaceHref({
        detailBasePath: "/admin/plano-acao/rec-1",
        actionsTabHrefSegment: "acoes",
        planId: "plan-1",
      }),
    ).toBe("/admin/plano-acao/rec-1/acoes?action=plan-1");
    expect(
      actionPanelFromSearchParams(
        new URLSearchParams("action=plan-1&panel=evidence"),
        new Set(["plan-1"]),
      ),
    ).toEqual({ kind: "evidence", planId: "plan-1" });
  });
});

describe("ActionMonitoringSummary", () => {
  it("mostra o resumo compacto da ação selecionada, sem repetir a descrição", () => {
    render(
      <ActionMonitoringSummary
        plans={[plan()]}
        selectedPlan={plan()}
        onSelectAction={vi.fn()}
        detailsHref="/admin/plano-acao/rec-1/acoes?action=plan-1"
      />,
    );
    expect(screen.getByRole("heading", { name: "Ação monitorada" })).toBeTruthy();
    expect(screen.getByLabelText("Ação monitorada")).toBeTruthy();
    expect(screen.getByText("Responsável")).toBeTruthy();
    expect(screen.getByText("Situação")).toBeTruthy();
    expect(screen.getByText("Progresso")).toBeTruthy();
    expect(screen.getByText("Início")).toBeTruthy();
    expect(screen.getByText("Prazo final")).toBeTruthy();
    expect(screen.getByText("Última atualização")).toBeTruthy();
    expect(screen.getByText("45%")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver detalhes da ação" })).toBeTruthy();
    expect(screen.queryByText("Ação", { selector: "dt" })).toBeNull();
  });
});

describe("PendingDecisionsSection", () => {
  it("apresenta a solicitação de prazo com as ações reais do domínio", () => {
    render(
      <ConfirmProvider>
        <PendingDecisionsSection
          items={[
            {
              kind: "deadline",
              occurredAt: "2026-08-12T23:11:00Z",
              request: {
                id: "dl-1",
                actionPlanId: "plan-1",
                recommendationId: "rec-1",
                organizationId: "org-1",
                actionRevision: 1,
                previousDueDate: "2026-09-30",
                requestedDueDate: "2026-10-31",
                reason: "Necessário prazo adicional.",
                status: "pending",
                requestedBy: "user-1",
                requestedByName: "Ana",
                requestedAt: "2026-08-12T23:11:00Z",
                decidedBy: null,
                decidedByName: null,
                decidedAt: null,
                decisionReason: null,
                appliedActionRevision: null,
              },
            },
          ]}
          role="admin"
          loading={false}
          onDeadlineUpdated={vi.fn()}
          onNoteUpdated={vi.fn()}
        />
      </ConfirmProvider>,
    );
    expect(screen.getByText("Solicitação de alteração de prazo")).toBeTruthy();
    expect(screen.getByText("Necessário prazo adicional.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aprovar alteração" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Recusar" })).toBeTruthy();
  });

  it("não renderiza um container vazio alto quando não há pendência", () => {
    render(
      <ConfirmProvider>
        <PendingDecisionsSection
          items={[]}
          role="admin"
          loading={false}
          onDeadlineUpdated={vi.fn()}
          onNoteUpdated={vi.fn()}
        />
      </ConfirmProvider>,
    );
    expect(screen.getByText("Nenhuma pendência para esta ação.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Aprovar alteração" })).toBeNull();
  });
});

describe("MonitoringComposer", () => {
  it("associa o registro à ação monitorada, sem escopo geral", () => {
    render(
      <MonitoringComposer
        recommendationId="rec-1"
        plan={plan()}
        openRequestActionIds={new Set()}
        onCreated={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Registrar acompanhamento" })).toBeTruthy();
    expect(screen.queryByLabelText("Registro")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Registrar acompanhamento" }));
    expect(screen.getByLabelText("Tipo")).toBeTruthy();
    expect(screen.queryByLabelText("Vinculado a")).toBeNull();
    expect(screen.getByRole("button", { name: "Publicar acompanhamento" })).toBeTruthy();
  });

  it("oferece todos os registros de supervisão previstos pelo domínio", () => {
    render(
      <MonitoringComposer
        recommendationId="rec-1"
        plan={plan()}
        openRequestActionIds={new Set()}
        onCreated={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Registrar acompanhamento" }));
    const typeSelect = screen.getByLabelText("Tipo");
    expect(typeSelect.textContent).toContain("Parecer / orientação");
    expect(typeSelect.textContent).toContain("Pendência");
    expect(typeSelect.textContent).toContain("Encaminhamento");
    expect(typeSelect.textContent).toContain("Solicitação de ajuste");
    expect(typeSelect.textContent).toContain("Decisão / aceite");
  });

  it("bloqueia o aceite antecipadamente quando falta comprovação válida", () => {
    render(
      <MonitoringComposer
        recommendationId="rec-1"
        plan={plan({ status: "completed", progressPercentage: 100, documents: [] })}
        openRequestActionIds={new Set()}
        onCreated={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Registrar acompanhamento" }));
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "approval" } });
    fireEvent.change(screen.getByLabelText("Registro"), { target: { value: "Execução aceita." } });

    expect(
      screen.getByText(
        "Adicione ao menos uma comprovação válida da revisão atual antes de registrar o aceite.",
      ),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Publicar acompanhamento" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("mantém o aceite bloqueado enquanto verifica pendências abertas", () => {
    render(
      <MonitoringComposer
        recommendationId="rec-1"
        plan={plan({
          status: "completed",
          progressPercentage: 100,
          documents: [
            {
              id: "doc-link",
              actionRevision: 1,
              kind: "link",
              title: "Publicação institucional",
              externalLink: "https://example.gov.br/comprovacao",
              originalFilename: null,
              mimeType: null,
              sizeBytes: null,
              fileValidationStatus: "not_applicable",
              validatedAt: null,
              createdAt: "2026-08-21T12:00:00Z",
              isCurrentRevision: true,
            },
          ],
        })}
        openRequestActionIds={new Set()}
        checkingOpenRequests
        onCreated={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Registrar acompanhamento" }));
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "approval" } });
    expect(
      screen.getByText(
        "Verificando solicitações e pendências abertas antes de liberar o aceite.",
      ),
    ).toBeTruthy();
  });
});

describe("RecentActivitySection", () => {
  it("mostra o histórico da ação na tabela institucional", () => {
    render(
      <RecentActivitySection
        items={[
          {
            id: "pg-1",
            previousPercentage: 7,
            newPercentage: 9,
            previousStatus: "in_progress",
            newStatus: "in_progress",
            description: null,
            createdAt: "2026-08-11T12:00:00Z",
            createdByName: "Flávio Henrique dos Santos Lima",
          },
          {
            id: "pg-2",
            previousPercentage: 13,
            newPercentage: 15,
            previousStatus: "in_progress",
            newStatus: "in_progress",
            description: "adasd",
            createdAt: "2026-08-13T15:48:00Z",
            createdByName: "Flávio Henrique dos Santos Lima",
          },
        ]}
        loading={false}
      />,
    );
    expect(screen.getByRole("heading", { name: "Histórico da ação" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Data" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Situação" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Atualização" })).toBeTruthy();
    expect(screen.getByText("adasd")).toBeTruthy();
    expect(screen.getByText("Progresso atualizado para 9%")).toBeTruthy();
    expect(screen.getAllByText("Em andamento").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Flávio Henrique dos Santos Lima").length).toBe(2);
    expect(screen.queryByRole("link", { name: "Ver histórico completo da ação" })).toBeNull();
  });
});

describe("ExecutionProofsSection", () => {
  it("resume as comprovações da revisão atual", () => {
    render(
      <ExecutionProofsSection
        plan={plan({
          documents: [
            {
              id: "doc-1",
              actionRevision: 1,
              kind: "file",
              title: "Ofício de publicação",
              externalLink: null,
              originalFilename: "oficio.pdf",
              mimeType: "application/pdf",
              sizeBytes: 2048,
              fileValidationStatus: "rejected",
              validatedAt: "2026-08-13T10:00:00Z",
              createdAt: "2026-08-13T10:00:00Z",
              isCurrentRevision: true,
            },
          ],
        })}
        consultHref="/admin/plano-acao/rec-1/acoes?action=plan-1&panel=evidence"
      />,
    );
    expect(screen.getByRole("heading", { name: "Comprovações da execução" })).toBeTruthy();
    expect(screen.getByText("1 comprovação · 1 formato rejeitado")).toBeTruthy();
    expect(screen.getByText("Ofício de publicação")).toBeTruthy();
    expect(screen.getByText("Formato rejeitado")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Consultar comprovações" })).toBeTruthy();
  });
});

describe("AuditHistorySection", () => {
  it("mantém a auditoria técnica recolhida por padrão", () => {
    render(
      <AuditHistorySection
        items={[]}
        loading={false}
        error={null}
        total={0}
        offset={0}
        pageSize={20}
        hasMore={false}
        onRetry={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Ver auditoria da ação" })).toBeTruthy();
    expect(screen.queryByText("Nenhuma alteração registrada nesta ação ainda.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver auditoria da ação" }));
    expect(screen.getByText("Nenhuma alteração registrada nesta ação ainda.")).toBeTruthy();
  });
});
