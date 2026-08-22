import { reportLevelLabel } from "@/features/reports/pdf/build-official-report-data";
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

export function renderConclusionSection(doc: OrientaPdfDocument): Cursor {
  let cur = doc.beginMajorSection(
    "Conclusão institucional",
    undefined,
    "conclusion",
  );

  const d = doc.data;
  const g = d.fami.global;

  cur = doc.drawSubsectionTitle(cur, "Leitura institucional");
  const maturityInterpretation =
    g.maturityLevel == null
      ? "O FAMI não é aplicável a este diagnóstico porque não há critérios aplicáveis para classificação de maturidade."
      : `O diagnóstico posiciona a organização em ${reportLevelLabel(g.maturityLevel)}. O resultado registra a situação aferida no diagnóstico; as ações, comprovações e decisões de supervisão apresentadas neste relatório documentam o tratamento realizado até o encerramento da avaliação.`;
  cur = doc.drawParagraph(cur, maturityInterpretation, { size: 10, gap: 2 });

  cur = doc.drawSubsectionTitle(cur, "Encaminhamentos para o próximo ciclo");
  const actions = conclusionPriorityActions({
    criticalAxesCount: d.criticalAxesCount,
    topOpportunityAxis: d.topOpportunityAxis,
  });

  for (const [index, action] of actions.entries()) {
    cur = doc.drawParagraph(cur, `${index + 1}. ${action}`, {
      size: 9,
      color: reportTheme.slate700,
      gap: 2,
    });
  }

  return cur;
}
