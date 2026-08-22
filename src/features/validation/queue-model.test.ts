import { describe, expect, it } from "vitest";
import {
  ALL_AXES_PARAM,
  ALL_SECTIONS_PARAM,
  DOCUMENT_STATUS_LABEL,
  EVIDENCE_JUSTIFICATION_PRESETS,
  VERDICT_LABEL,
  absentEvidenceStatusFromProof,
  axisFormOrder,
  axisPendingCount,
  buildSectionNavigation,
  canSubmitNaVerdict,
  canSubmitVerdict,
  deriveResponseEvidenceStatus,
  formSectionsCoverageCaption,
  groupSectionsByAxis,
  justificationRequired,
  pickPreferredSectionIdForAxis,
  resolveSelectedAxisId,
  resolveSelectedSectionId,
  sectionChipStatusLabel,
  sectionSelectorStatusSuffix,
  sectionsForAxis,
} from "./queue-model";
import type { QueueEvidence } from "./queue-model";

function evidence(
  overrides: Partial<QueueEvidence> & {
    id: string;
    status: QueueEvidence["status"];
  },
): QueueEvidence {
  return {
    responseId: `response-${overrides.id}`,
    questionPrompt: "Q",
    sectionId: "section-s",
    sectionName: "S",
    sectionOrder: 0,
    axisId: "axis-a",
    axisName: "A",
    orderIndex: 0,
    kind: "file",
    fileName: "f.pdf",
    externalLink: null,
    linkReason: null,
    submittedAt: null,
    justification: null,
    answer: "yes",
    respondentNote: null,
    answeredByName: null,
    answeredAt: null,
    ...overrides,
  };
}

describe("política de decisão da validação", () => {
  it("mantém os motivos oficiais e a pontuação sem mascarar insuficiência", () => {
    expect(EVIDENCE_JUSTIFICATION_PRESETS).toEqual([
      "Evidência não apresentada",
      "Evidência insuficiente",
    ]);
    expect(VERDICT_LABEL.invalidated).toBe("Insuficiente");
    expect(VERDICT_LABEL.considered_insufficient).toBe("Insuficiente");
    expect(VERDICT_LABEL.pending).toBe("Aguardando validação");
    expect(DOCUMENT_STATUS_LABEL.pending).toBe("Aguardando análise");
    expect(DOCUMENT_STATUS_LABEL.approved).toBe("Aprovado");
    expect(absentEvidenceStatusFromProof("considered_insufficient")).toBe(
      "considered_insufficient",
    );
  });

  it("exige justificativa somente nas decisões negativas", () => {
    expect(justificationRequired("approve")).toBe(false);
    expect(canSubmitVerdict("approve", "")).toBe(true);
    expect(canSubmitVerdict("invalidate", "  ")).toBe(false);
    expect(canSubmitVerdict("invalidate", "Documento ilegível.")).toBe(true);
    expect(canSubmitVerdict("request_adjustment", "")).toBe(false);
    expect(canSubmitNaVerdict("approve", "")).toBe(true);
    expect(canSubmitNaVerdict("reject", "   ")).toBe(false);
  });
});

describe("status agregado de evidência", () => {
  it("respeita a precedência oficial", () => {
    expect(
      deriveResponseEvidenceStatus([
        { status: "approved" },
        { status: "adjustment_requested" },
      ]),
    ).toBe("adjustment_requested");
    expect(
      deriveResponseEvidenceStatus([{ status: "approved" }, { status: "pending" }]),
    ).toBe("pending");
    expect(
      deriveResponseEvidenceStatus([
        { status: "approved" },
        { status: "invalidated" },
      ]),
    ).toBe("approved");
    expect(
      deriveResponseEvidenceStatus([
        { status: "invalidated" },
        { status: "invalidated" },
      ]),
    ).toBe("invalidated");
  });

  it("representa ausência documental sem criar documento fictício", () => {
    expect(deriveResponseEvidenceStatus([])).toBe("not_presented");
    expect(
      deriveResponseEvidenceStatus([
        { status: "not_presented", absentEvidence: true },
      ]),
    ).toBe("not_presented");
  });
});

describe("navegação por seções", () => {
  it("agrupa e conta pendências com identificadores estáveis", () => {
    const navigation = buildSectionNavigation([
      evidence({
        id: "1",
        status: "pending",
        sectionId: "sec-a",
        sectionName: "Gestão Correcional",
        sectionOrder: 1,
        axisId: "ax-1",
        axisName: "Governança",
      }),
      evidence({
        id: "2",
        status: "approved",
        sectionId: "sec-a",
        sectionName: "Gestão Correcional",
        sectionOrder: 1,
        axisId: "ax-1",
        axisName: "Governança",
      }),
      evidence({
        id: "3",
        status: "proof_requested",
        sectionId: "sec-b",
        sectionName: "Proteção de Dados",
        sectionOrder: 2,
        axisId: "ax-1",
        axisName: "Governança",
      }),
    ]);

    expect(navigation.totalPending).toBe(2);
    expect(navigation.sections[0]).toMatchObject({
      id: "sec-a",
      pendingCount: 1,
      completedCount: 1,
    });
    expect(resolveSelectedSectionId("sec-b", navigation.sections)).toBe("sec-b");
    expect(resolveSelectedSectionId("ausente", navigation.sections)).toBe(
      ALL_SECTIONS_PARAM,
    );
  });

  it("usa a ordem ESG oficial, não a ordem alfabética", () => {
    const navigation = buildSectionNavigation([
      evidence({
        id: "1",
        status: "pending",
        sectionId: "sec-amb",
        sectionName: "Agenda Ambiental",
        sectionOrder: 1,
        axisId: "ax-amb",
        axisName: "Ambiental",
      }),
      evidence({
        id: "2",
        status: "pending",
        sectionId: "sec-soc",
        sectionName: "Integração social",
        sectionOrder: 1,
        axisId: "ax-soc",
        axisName: "Social",
      }),
      evidence({
        id: "3",
        status: "pending",
        sectionId: "sec-gov",
        sectionName: "Governança",
        sectionOrder: 1,
        axisId: "ax-gov",
        axisName: "Governança",
      }),
    ]);

    expect(navigation.groups.map((group) => group.axisName)).toEqual([
      "Governança",
      "Ambiental",
      "Social",
    ]);
    expect(axisFormOrder("Governanca")).toBe(0);
    expect(groupSectionsByAxis(navigation.sections).map((group) => group.axisName)).toEqual([
      "Governança",
      "Ambiental",
      "Social",
    ]);
  });

  it("distingue seção concluída de seção sem itens", () => {
    expect(sectionSelectorStatusSuffix(0, 0)).toBe(" — sem itens para validar");
    expect(sectionSelectorStatusSuffix(0, 3)).toBe(" — concluída");
    expect(sectionSelectorStatusSuffix(2, 3)).toBe(" — 2 pendentes");
    expect(sectionChipStatusLabel(0, 0)).toBe("Sem itens");
    expect(sectionChipStatusLabel(0, 3)).toBe("Concluída");
    expect(sectionChipStatusLabel(2, 3)).toBe("2 pendentes");
    expect(formSectionsCoverageCaption(22, 0)).toBe(
      "22 de 22 seções conferidas — nenhuma seção ausente",
    );
  });

  it("resolve eixo e prefere seção pendente sem escolher concluída", () => {
    const navigation = buildSectionNavigation([
      evidence({
        id: "1",
        status: "approved",
        sectionId: "sec-done",
        sectionName: "Concluída",
        sectionOrder: 1,
        axisId: "ax-gov",
        axisName: "Governança",
      }),
      evidence({
        id: "2",
        status: "pending",
        sectionId: "sec-pend",
        sectionName: "Pendente",
        sectionOrder: 2,
        axisId: "ax-gov",
        axisName: "Governança",
      }),
      evidence({
        id: "3",
        status: "pending",
        sectionId: "sec-amb",
        sectionName: "Ambiental",
        sectionOrder: 1,
        axisId: "ax-amb",
        axisName: "Ambiental",
      }),
    ]);

    expect(resolveSelectedAxisId(null, navigation.groups)).toBe(ALL_AXES_PARAM);
    expect(resolveSelectedAxisId("ax-gov", navigation.groups)).toBe("ax-gov");
    expect(resolveSelectedAxisId("ausente", navigation.groups)).toBe(
      ALL_AXES_PARAM,
    );
    expect(axisPendingCount(navigation.groups[0]!)).toBe(1);
    expect(
      pickPreferredSectionIdForAxis(
        sectionsForAxis(navigation.sections, "ax-gov"),
      ),
    ).toBe("sec-pend");
    expect(sectionsForAxis(navigation.sections, "ax-amb")).toHaveLength(1);
  });
});
