import writeXlsxFile, { type Sheet } from "write-excel-file/node";
import { rgb } from "pdf-lib";
import {
  QUESTION_ANSWER_TYPE_LABEL,
  RESPONDENT_STATUS_LABEL,
  type AnswersOverview,
  type AnswersSummary,
  type RespondentRow,
} from "./answers-types";
import { createCsvContent } from "@/shared/export/csv";
import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import {
  createBasicPdfTextContext,
  drawBasicPdfDivider,
  drawBasicPdfParagraph,
  drawBasicPdfSpacer,
  drawBasicPdfText,
} from "@/shared/export/basic-pdf-text";

export type ExportPayload = {
  form: { id: string; name: string };
  overview: AnswersOverview;
  summary: AnswersSummary;
  respondents: RespondentRow[];
  generatedAtIso?: string;
};

function formatDateBr(iso: string | null): string {
  return formatPlatformDateTime(iso, { dateStyle: "short", timeStyle: "short" });
}


/**
 * Gera um CSV (delimitador `;` para compatibilidade com Excel pt-BR) contendo:
 *   - cabecalho com metadados do formulario
 *   - linha em branco
 *   - tabela de respondentes (orgao, status, respostas, ultima atualizacao)
 *   - linha em branco
 *   - resumo por pergunta com totais por valor
 */
export function buildAnswersCsv(payload: ExportPayload): string {
  const rows: unknown[][] = [
    ["Formulário", payload.form.name],
    ["Total de respondentes", payload.overview.totalRespondents],
    ["Total de diagnósticos", payload.overview.totalCycles],
    ["Total de perguntas", payload.overview.totalQuestions],
    ["Última resposta", formatDateBr(payload.overview.lastAnswerAt)],
    ["Gerado em", formatDateBr(payload.generatedAtIso ?? new Date().toISOString())],
    [],
    ["RESPONDENTES"],
    [
      "Organização",
      "Período",
      "Situação",
      "Respondidas",
      "Total de perguntas",
      "Contribuintes",
      "Última atualização",
    ],
  ];

  for (const respondent of payload.respondents) {
    rows.push([
      respondent.organizationName,
      respondent.periodLabel,
      RESPONDENT_STATUS_LABEL[respondent.status],
      respondent.answeredQuestions,
      respondent.totalQuestions,
      respondent.contributorCount,
      formatDateBr(respondent.lastUpdatedAt),
    ]);
  }

  rows.push(
    [],
    ["RESUMO POR PERGUNTA"],
    ["#", "Pergunta", "Formato", "Respostas", "Sim", "Não", "Não se aplica"],
  );

  for (const question of payload.summary.questions) {
    rows.push([
      question.orderIndex + 1,
      question.prompt,
      QUESTION_ANSWER_TYPE_LABEL[question.answerType],
      question.totalResponses,
      question.distribution.yes,
      question.distribution.no,
      question.distribution.not_applicable,
    ]);
  }

  return createCsvContent(rows);
}

/**
 * Gera um PDF resumo (cabecalho + KPIs + resumo por pergunta + lista de
 * respondentes). Estilo neutro alinhado a `src/features/reports/pdf/pdf.ts`.
 */
export async function buildAnswersPdf(
  payload: ExportPayload,
): Promise<Uint8Array> {
  const ctx = await createBasicPdfTextContext();

  drawBasicPdfText(ctx, "Relatório de respostas - Plataforma Orienta", {
    size: 16,
    bold: true,
  });
  drawBasicPdfSpacer(ctx, 4);
  drawBasicPdfText(ctx, `Formulário: ${payload.form.name}`, { size: 11 });
  drawBasicPdfText(
    ctx,
    `Gerado em: ${formatDateBr(payload.generatedAtIso ?? new Date().toISOString())}`,
    { size: 9, color: rgb(0.35, 0.35, 0.35) },
  );
  drawBasicPdfSpacer(ctx, 6);
  drawBasicPdfDivider(ctx);

  drawBasicPdfText(ctx, "Visão geral", { size: 13, bold: true });
  drawBasicPdfText(
    ctx,
    `Total de respondentes: ${payload.overview.totalRespondents}`,
    { indent: 6 },
  );
  drawBasicPdfText(ctx, `Total de diagnósticos: ${payload.overview.totalCycles}`, { indent: 6 });
  drawBasicPdfText(
    ctx,
    `Total de perguntas: ${payload.overview.totalQuestions}`,
    { indent: 6 },
  );
  drawBasicPdfText(
    ctx,
    `Última resposta: ${
      payload.overview.lastAnswerAt
        ? formatDateBr(payload.overview.lastAnswerAt)
        : "—"
    }`,
    { indent: 6 },
  );
  drawBasicPdfSpacer(ctx, 4);
  drawBasicPdfText(ctx, "Situação dos respondentes:", { bold: true, indent: 6 });
  for (const status of Object.keys(payload.overview.statusBreakdown) as Array<
    keyof typeof payload.overview.statusBreakdown
  >) {
    drawBasicPdfText(
      ctx,
      `- ${RESPONDENT_STATUS_LABEL[status]}: ${payload.overview.statusBreakdown[status]}`,
      { indent: 14, size: 10 },
    );
  }
  drawBasicPdfSpacer(ctx, 6);
  drawBasicPdfDivider(ctx);

  drawBasicPdfText(ctx, "Resumo por pergunta", { size: 13, bold: true });
  drawBasicPdfSpacer(ctx, 2);
  for (const q of payload.summary.questions) {
    drawBasicPdfParagraph(ctx, `${q.orderIndex + 1}. ${q.prompt}`, { bold: true });
    drawBasicPdfText(
      ctx,
      `Formato: ${QUESTION_ANSWER_TYPE_LABEL[q.answerType]} - Respostas: ${q.totalResponses}`,
      { size: 9, indent: 6, color: rgb(0.35, 0.35, 0.35) },
    );
    drawBasicPdfText(
      ctx,
      `Sim: ${q.distribution.yes} | Não: ${q.distribution.no} | Não se aplica: ${q.distribution.not_applicable}`,
      { size: 10, indent: 6 },
    );
    drawBasicPdfSpacer(ctx, 4);
  }
  drawBasicPdfDivider(ctx);

  drawBasicPdfText(ctx, "Respondentes", { size: 13, bold: true });
  drawBasicPdfSpacer(ctx, 2);
  for (const r of payload.respondents) {
    drawBasicPdfParagraph(ctx, `${r.organizationName} — período ${r.periodLabel}`, { bold: true });
    drawBasicPdfText(
      ctx,
      `Situação: ${RESPONDENT_STATUS_LABEL[r.status]} - ${r.answeredQuestions}/${r.totalQuestions} respondidas`,
      { size: 10, indent: 6 },
    );
    drawBasicPdfText(
      ctx,
      `Última atualização: ${formatDateBr(r.lastUpdatedAt)} - Contribuintes: ${r.contributorCount}`,
      { size: 9, indent: 6, color: rgb(0.35, 0.35, 0.35) },
    );
    drawBasicPdfSpacer(ctx, 3);
  }

  return ctx.pdf.save();
}

/**
 * Monta os dados das abas XLSX sem I/O. A função é exposta para que a
 * cobertura do exportador valide o contrato da planilha sem depender de um
 * segundo leitor XLSX em produção.
 */
export function buildAnswersXlsxSheets(payload: ExportPayload): Sheet<Buffer>[] {
  const header = (value: string) => ({
    value,
    fontWeight: "bold" as const,
    textColor: "#FFFFFF",
    backgroundColor: "#1E293B",
    alignVertical: "center" as const,
  });

  const sheets: Sheet<Buffer>[] = [
    {
      sheet: "Resumo",
      columns: [{ width: 26 }, { width: 48 }],
      data: [
        [
          { value: "Formulário", fontWeight: "bold" as const },
          payload.form.name,
        ],
        [
          { value: "Total de respondentes", fontWeight: "bold" as const },
          payload.overview.totalRespondents,
        ],
        [
          { value: "Total de diagnósticos", fontWeight: "bold" as const },
          payload.overview.totalCycles,
        ],
        [
          { value: "Total de perguntas", fontWeight: "bold" as const },
          payload.overview.totalQuestions,
        ],
        [
          { value: "Última resposta", fontWeight: "bold" as const },
          payload.overview.lastAnswerAt
            ? formatDateBr(payload.overview.lastAnswerAt)
            : "—",
        ],
        [
          { value: "Gerado em", fontWeight: "bold" as const },
          formatDateBr(payload.generatedAtIso ?? new Date().toISOString()),
        ],
      ],
    },
    {
      sheet: "Respondentes",
      stickyRowsCount: 1,
      columns: [
        { width: 40 },
        { width: 16 },
        { width: 20 },
        { width: 14 },
        { width: 18 },
        { width: 14 },
        { width: 22 },
      ],
      data: [
        [
          header("Organização"),
          header("Período"),
          header("Situação"),
          header("Respondidas"),
          header("Total de perguntas"),
          header("Contribuintes"),
          header("Última atualização"),
        ],
        ...payload.respondents.map((respondent) => [
          respondent.organizationName,
          respondent.periodLabel,
          RESPONDENT_STATUS_LABEL[respondent.status],
          respondent.answeredQuestions,
          respondent.totalQuestions,
          respondent.contributorCount,
          formatDateBr(respondent.lastUpdatedAt),
        ]),
      ],
    },
    {
      sheet: "Resumo por pergunta",
      stickyRowsCount: 1,
      columns: [
        { width: 6 },
        { width: 60 },
        { width: 14 },
        { width: 12 },
        { width: 8 },
        { width: 8 },
        { width: 14 },
      ],
      data: [
        [
          header("#"),
          header("Pergunta"),
          header("Formato"),
          header("Respostas"),
          header("Sim"),
          header("Não"),
          header("Não se aplica"),
        ],
        ...payload.summary.questions.map((question) => [
          question.orderIndex + 1,
          { value: question.prompt, wrap: true, alignVertical: "top" as const },
          QUESTION_ANSWER_TYPE_LABEL[question.answerType],
          question.totalResponses,
          question.distribution.yes,
          question.distribution.no,
          question.distribution.not_applicable,
        ]),
      ],
    },
  ];


  return sheets;
}

/**
 * Gera uma planilha XLSX com abas de resumo, respondentes e perguntas.
 * `write-excel-file` é mantido como dependência direta e não introduz a
 * cadeia vulnerável do antigo ExcelJS.
 */
export async function buildAnswersXlsx(payload: ExportPayload): Promise<Buffer> {
  const file = await writeXlsxFile(buildAnswersXlsxSheets(payload), {
    fontFamily: "Arial",
    fontSize: 10,
  }).toBuffer();
  return Buffer.from(file);
}
