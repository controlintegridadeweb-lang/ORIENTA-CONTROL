import { reportLevelLabel } from "@/features/reports/pdf/build-official-report-data";
import { structuralAxisOrderIndex } from "@/shared/domain/axis";
import { formatReportPercentage } from "../formatters";
import type { Cursor, OrientaPdfDocument } from "../document";
import { reportTheme } from "../theme";

export function conclusionPriorityActions(params: {
  criticalAxesCount: number;
  topOpportunityAxis?: string | null;
}): string[] {
  const actions: string[] = [];

  if (params.criticalAxesCount > 0) {
    actions.push(
      params.topOpportunityAxis
        ? `Registrar o eixo ${params.topOpportunityAxis} e os demais eixos críticos como prioridades do próximo ciclo de avaliação.`
        : "Registrar os eixos críticos como prioridades do próximo ciclo de avaliação.",
    );
  }

  actions.push(
    "Preservar as comprovações e os registros de supervisão que sustentam o encerramento desta avaliação.",
  );
  actions.push(
    "Acompanhar a sustentabilidade dos resultados alcançados e incorporar novas necessidades ao próximo ciclo de avaliação.",
  );
  return actions;
}

function buildInstitutionalReading(doc: OrientaPdfDocument): string[] {
  const d = doc.data;
  const g = d.fami.global;
  const paragraphs: string[] = [];
  const recTotal = d.actionPlan.summary.totalRecommendations;
  const actionTotal = d.actionPlan.summary.totalActions;
  const byStatus = d.actionPlan.summary.actionsByStatus;
  const planParagraph =
    `Foram identificadas ${recTotal} ${recTotal === 1 ? "recomendação" : "recomendações"} e ${actionTotal} ${actionTotal === 1 ? "ação" : "ações"} no plano de integridade e compliance (${byStatus.completed ?? 0} concluídas, ${byStatus.in_progress ?? 0} em andamento, ${byStatus.not_started ?? 0} não iniciadas e ${byStatus.cancelled ?? 0} canceladas).`;

  if (d.tracking) {
    paragraphs.push(planParagraph);
    paragraphs.push(
      "As ações, comprovações e registros apresentados documentam o andamento do plano até o corte deste bimestre.",
    );
    return paragraphs;
  }

  if (g.maturityLevel == null) {
    paragraphs.push(
      "O FAMI não é aplicável a este diagnóstico porque não há critérios aplicáveis para classificação de maturidade.",
    );
  } else {
    paragraphs.push(
      `O diagnóstico posiciona a organização em ${reportLevelLabel(g.maturityLevel)}, com desempenho geral de ${formatReportPercentage(g.percentage)}.`,
    );
  }

  const applicable = [...d.fami.byAxis]
    .filter((axis) => axis.maturityLevel != null)
    .sort(
      (a, b) =>
        structuralAxisOrderIndex(a.axisName) - structuralAxisOrderIndex(b.axisName) ||
        a.axisName.localeCompare(b.axisName, "pt-BR"),
    );

  if (applicable.length > 0) {
    const byScore = [...applicable].sort((a, b) => b.percentage - a.percentage);
    const best = byScore[0]!;
    const weakest = byScore[byScore.length - 1]!;
    if (byScore.length === 1) {
      paragraphs.push(
        `O eixo avaliado (${best.axisName}) registrou ${formatReportPercentage(best.percentage)}.`,
      );
    } else if (best.axisId === weakest.axisId) {
      paragraphs.push(
        `Os eixos aplicáveis apresentam desempenho equivalente em ${formatReportPercentage(best.percentage)}.`,
      );
    } else {
      paragraphs.push(
        `O eixo com melhor resultado foi ${best.axisName} (${formatReportPercentage(best.percentage)}). O eixo que demanda maior atenção foi ${weakest.axisName} (${formatReportPercentage(weakest.percentage)}).`,
      );
    }
  }

  paragraphs.push(planParagraph);
  paragraphs.push(
    "O resultado registra a situação aferida no diagnóstico; as ações, comprovações e registros de acompanhamento apresentados neste relatório documentam o tratamento realizado até a emissão.",
  );

  return paragraphs;
}

export function renderConclusionSection(doc: OrientaPdfDocument): Cursor {
  let cur = doc.beginMajorSection(
    "Conclusão institucional",
    undefined,
    "conclusion",
  );

  cur = doc.drawSubsectionTitle(cur, "Leitura institucional");
  for (const paragraph of buildInstitutionalReading(doc)) {
    cur = doc.drawParagraph(cur, paragraph, { size: 10, gap: 2 });
  }

  cur = doc.drawSubsectionTitle(cur, "Encaminhamentos para o próximo ciclo");
  const actions = conclusionPriorityActions({
    criticalAxesCount: doc.data.criticalAxesCount,
    topOpportunityAxis: doc.data.topOpportunityAxis,
  });

  const plan = doc.data.actionPlan.summary;
  const concrete: string[] = [];
  if (plan.totalRecommendations > 0) {
    concrete.push(
      `Manter o acompanhamento das ${plan.totalRecommendations} recomendações registradas neste ciclo até a consolidação das evidências no próximo diagnóstico.`,
    );
  }
  if ((plan.actionsByStatus.in_progress ?? 0) > 0) {
    concrete.push(
      `Concluir as ${plan.actionsByStatus.in_progress} ações ainda em andamento e atualizar o progresso com comprovações.`,
    );
  }

  const all = [...concrete, ...actions];
  for (const [index, action] of all.entries()) {
    cur = doc.drawParagraph(cur, `${index + 1}. ${action}`, {
      size: 9,
      color: reportTheme.slate700,
      gap: 2,
    });
  }

  return cur;
}
