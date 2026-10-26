import { describe, expect, it } from "vitest";
import {
  assertAuthorizedHomologacaoProject,
  assertPreviewOnly,
  AUTHORIZED_HOMOLOGACAO_PROJECT,
  CATALOG_FORM_NAME,
  planE2eCleanup,
} from "./e2e-cleanup-plan.mjs";

const RUN_ID = "261023154012ab";

function snapshot(overrides = {}) {
  return {
    axes: ["Ambiental", "Governanca", "Social"],
    organizations: [{ name: "Órgão de Teste E2E" }, { name: "Órgão Externo E2E" }],
    users: [
      { id: "admin", email: "admin.e2e@orienta.local" },
      { id: "lacuna", email: "membro.lacuna@orienta.test" },
    ],
    forms: [
      { id: "catalog", name: CATALOG_FORM_NAME, published: true },
      {
        id: "published-run",
        name: `Diagnóstico E2E - Jornada Canônica ${RUN_ID}`,
        published: true,
      },
      {
        id: "percentual-run",
        name: `Diagnóstico E2E - Jornada Canônica ${RUN_ID} percentual`,
        published: true,
      },
      {
        id: "draft-old",
        name: "Diagnóstico E2E - Jornada Canônica (interrompido 140538)",
        published: false,
      },
      { id: "bare", name: "Diagnóstico E2E - Jornada Canônica", published: true },
    ],
    cycles: [
      {
        id: "cycle-run",
        formId: "published-run",
        state: "in_response",
        periodLabel: `E2E ${RUN_ID}`,
        organizationName: "Órgão de Teste E2E",
        responseCollectionPausedAt: null,
      },
      {
        id: "cycle-percentual",
        formId: "percentual-run",
        state: "validated",
        periodLabel: `E2E ${RUN_ID} percentual`,
        organizationName: "Órgão de Teste E2E",
        responseCollectionPausedAt: null,
      },
      {
        id: "cycle-bare",
        formId: "bare",
        state: "in_response",
        periodLabel: "2026 — E2E",
        organizationName: "Órgão de Teste E2E",
        responseCollectionPausedAt: null,
      },
      {
        id: "cycle-catalog",
        formId: "catalog",
        state: "draft",
        periodLabel: "referência",
        organizationName: "Órgão de Teste E2E",
      },
    ],
    responses: [
      { id: "response-1", cycleId: "cycle-run" },
      { id: "response-bare", cycleId: "cycle-bare" },
    ],
    recommendations: [{ id: "rec-1", cycleId: "cycle-run" }],
    plans: [{ id: "plan-1", recommendationId: "rec-1" }],
    evidences: [
      { storagePath: "org/cycle-run/evidencia.png", cycleId: "cycle-run" },
      { storagePath: "org/cycle-bare/evidencia.png", cycleId: "cycle-bare" },
    ],
    reports: [{ filePath: "org/cycle-run/relatorio.pdf", cycleId: "cycle-run" }],
    actionPlanDocuments: [{ planId: "plan-1", storagePath: null, cycleId: "cycle-run" }],
    progressUpdates: [{ planId: "plan-1" }],
    auditLogs: [
      { recordId: "published-run", actorUserId: "admin" },
      { recordId: "lacuna", actorUserId: "admin" },
      { recordId: "bare", actorUserId: "admin" },
    ],
    libraryAuditEvents: 3,
    ...overrides,
  };
}

describe("plano de limpeza E2E", () => {
  it("recusa execução, produção e projeto desconhecido", () => {
    expect(() => assertPreviewOnly(["--execute"])).toThrow(/não exclui/);
    expect(() => assertPreviewOnly([])).not.toThrow();
    expect(() => assertAuthorizedHomologacaoProject("aaaaaaaaaaaaaaaaaaaa")).toThrow(
      /homologação autorizado/,
    );
    expect(() => assertAuthorizedHomologacaoProject(AUTHORIZED_HOMOLOGACAO_PROJECT)).not.toThrow();
  });

  it("exige identificador e período iguais para comprovar a jornada", () => {
    const plan = planE2eCleanup(snapshot());
    expect(plan.execute).toBe(false);
    expect(plan.exclusaoRemota).toBe("bloqueada");
    expect(plan.auditoria).toBe("preservada");
    expect(plan.blockers).toEqual([]);
    expect(plan.comprovados.forms.map((form) => form.id)).toEqual([
      "published-run",
      "percentual-run",
    ]);
    expect(plan.comprovados.cycles.map((cycle) => cycle.id)).toEqual([
      "cycle-run",
      "cycle-percentual",
    ]);
    expect(plan.comprovados.quantidades).toMatchObject({
      formularios: 2,
      ciclos: 2,
      respostas: 1,
      recomendacoes: 1,
      planos: 1,
      evidencias: 1,
      acompanhamentos: 1,
      documentosPlanoSemArquivo: 1,
      pdfs: 1,
    });
    expect(plan.incertos.forms.map((form) => form.id)).toEqual(["draft-old", "bare"]);
    expect(plan.incertos.forms.every((form) => form.elegibilidade.elegivel === false)).toBe(true);
    expect(plan.preservados.forms).toEqual([CATALOG_FORM_NAME]);
    expect(plan.preservados.cycles).toEqual(["cycle-catalog"]);
    expect(plan.preservados.users).toEqual(["admin.e2e@orienta.local"]);
    expect(plan.preservados.contasForaDaBase).toEqual([
      {
        email: "membro.lacuna@orienta.test",
        motivo: "A auditoria referencia a conta. Ela permanece.",
      },
    ]);
    expect(plan.comprovados.auditLogsPreservados).toBe(1);
    expect(plan.incertos.auditLogsPreservados).toBe(1);
    expect(plan.preservados.auditLogsTotal).toBe(3);
  });

  it("não trata coleta aberta, validada ou sem pausa como excluível", () => {
    const plan = planE2eCleanup(snapshot());
    const open = plan.comprovados.forms.find((form) => form.id === "published-run");
    const validated = plan.comprovados.forms.find((form) => form.id === "percentual-run");
    expect(open.elegibilidade.elegivel).toBe(false);
    expect(open.elegibilidade.motivo).toMatch(/sem pausa/);
    expect(validated.elegibilidade.elegivel).toBe(false);
    expect(validated.elegibilidade.motivo).toMatch(/Não há ciclo em preenchimento/);
    expect(plan.naoExcluiveisPelaRegraAtual.map((form) => form.id)).toEqual([
      "published-run",
      "percentual-run",
    ]);
  });

  it("reconhece a pausa real sem liberar a execução da prévia", () => {
    const base = snapshot();
    base.cycles[0] = { ...base.cycles[0], responseCollectionPausedAt: "2026-10-26T12:00:00Z" };
    const plan = planE2eCleanup(base);
    const open = plan.comprovados.forms.find((form) => form.id === "published-run");
    expect(open.elegibilidade.elegivel).toBe(true);
    expect(open.elegibilidade.operacao).toBe("admin_delete_suspended_form");
    expect(plan.execute).toBe(false);
    expect(plan.naoExcluiveisPelaRegraAtual.map((form) => form.id)).toEqual(["percentual-run"]);
  });

  it("bloqueia órgão fora do teste e arquivo compartilhado", () => {
    const outside = planE2eCleanup(
      snapshot({
        cycles: snapshot().cycles.map((cycle) =>
          cycle.id === "cycle-run" ? { ...cycle, organizationName: "Órgão institucional" } : cycle,
        ),
      }),
    );
    expect(outside.comprovados.forms.map((form) => form.id)).toEqual(["percentual-run"]);
    expect(outside.blockers.some((item) => item.includes(RUN_ID))).toBe(true);

    const shared = planE2eCleanup(
      snapshot({
        evidences: [
          { storagePath: "mesmo-arquivo.png", cycleId: "cycle-run" },
          { storagePath: "mesmo-arquivo.png", cycleId: "cycle-catalog" },
        ],
      }),
    );
    expect(shared.blockers.some((item) => item.includes("compartilhado"))).toBe(true);
    expect(shared.comprovados.storage.exclusivos).toEqual([
      { bucket: "relatorios", path: "org/cycle-run/relatorio.pdf" },
    ]);
    expect(shared.comprovados.storage.compartilhados).toEqual([
      { bucket: "evidencias", path: "mesmo-arquivo.png" },
    ]);
  });

  it("repete a mesma classificação para a mesma leitura", () => {
    const input = snapshot();
    expect(planE2eCleanup(input)).toEqual(planE2eCleanup(input));
  });

  it("interrompe quando o catálogo ou um eixo permanente some", () => {
    const missingCatalog = planE2eCleanup(
      snapshot({ forms: snapshot().forms.filter((form) => form.id !== "catalog") }),
    );
    expect(missingCatalog.blockers).toContain("O catálogo de critérios não apareceu na leitura.");
    const extraAxis = planE2eCleanup(snapshot({ axes: [...snapshot().axes, "Financeiro"] }));
    expect(extraAxis.blockers.some((item) => item.includes("Financeiro"))).toBe(true);
  });
});
