import type { EvidenceListItem, EvidenceStatsResult } from "./types";
import { STATUS_BADGE_META } from "./status-groups";
import { createCsvContent } from "@/shared/export/csv";
import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import {
  createBasicPdfTextContext,
  drawBasicPdfText,
  ensureBasicPdfSpace,
} from "@/shared/export/basic-pdf-text";

function formatDateBr(iso: string | null): string {
  return formatPlatformDateTime(iso, { dateStyle: "short", timeStyle: "short" }, "");
}

function statusLabel(status: EvidenceListItem["currentStatus"]): string {
  return STATUS_BADGE_META[status].label;
}

export function buildEvidencesCsv(items: EvidenceListItem[]): string {
  const rows: unknown[][] = [
    [
      "ID",
      "Formulário",
      "Pergunta",
      "Organização",
      "Enviada em",
      "Situação",
      "Título",
      "Tipo",
      "Texto",
      "Link",
      "Caminho",
      "Motivo da exceção",
    ],
  ];

  for (const item of items) {
    rows.push([
      item.id,
      item.formName,
      item.questionPrompt,
      item.organizationName,
      formatDateBr(item.submittedAt),
      statusLabel(item.currentStatus),
      item.title,
      item.evidenceType,
      item.textBody ?? "",
      item.externalLink ?? "",
      item.storagePath ?? "",
      item.exceptionReason ?? "",
    ]);
  }

  return createCsvContent(rows);
}

export type EvidencesExportPdfPayload = {
  items: EvidenceListItem[];
  stats: EvidenceStatsResult;
  generatedAtIso?: string;
};

export async function buildEvidencesPdf(
  payload: EvidencesExportPdfPayload,
): Promise<Uint8Array> {
  const ctx = await createBasicPdfTextContext({ bottomY: 50 });

  drawBasicPdfText(ctx, "Exportação de evidências — Plataforma Orienta", { size: 16, bold: true });
  drawBasicPdfText(
    ctx,
    `Gerado em: ${formatDateBr(payload.generatedAtIso ?? new Date().toISOString())}`,
    { size: 9 },
  );
  ctx.y -= 8;
  drawBasicPdfText(ctx, "Resumo", { size: 12, bold: true });
  drawBasicPdfText(ctx, `Total (export): ${payload.items.length}`, { size: 10 });
  drawBasicPdfText(
    ctx,
    `Aguardando validação: ${payload.stats.aguardando_validacao} | Ajuste solicitado: ${payload.stats.ajuste_solicitado} | Aprovadas: ${payload.stats.aprovadas} | Não aprovadas: ${payload.stats.nao_aprovadas}`,
    { size: 10 },
  );
  ctx.y -= 6;
  drawBasicPdfText(ctx, "Linhas", { size: 12, bold: true });

  for (const i of payload.items) {
    const head = `${i.formName} / ${i.organizationName}`;
    ensureBasicPdfSpace(ctx, 40);
    drawBasicPdfText(ctx, head, { bold: true, size: 10 });
    drawBasicPdfText(
      ctx,
      `${i.questionPrompt} — ${statusLabel(i.currentStatus)} — ${formatDateBr(i.submittedAt)}`,
      { size: 9 },
    );
    drawBasicPdfText(ctx, `${i.title} (${i.evidenceType})`, { size: 9 });
    ctx.y -= 4;
  }

  return ctx.pdf.save();
}
