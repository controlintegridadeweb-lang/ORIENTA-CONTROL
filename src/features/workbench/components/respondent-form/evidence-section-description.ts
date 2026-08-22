import type { WorkbenchRow } from "@/features/workbench/load-workbench-payload";
import { resolveEvidenceStatus } from "./evidence-rule-message";

function adjustmentCounts(row: WorkbenchRow) {
  const requested = row.adjustmentRequestCount ?? (row.hasAdjustmentRequest ? 1 : 0);
  const resolved = Math.min(
    requested,
    row.resolvedAdjustmentRequestCount ?? (row.hasResolvedAllAdjustments ? requested : 0),
  );
  const unresolved = Math.max(
    0,
    row.unresolvedAdjustmentRequestCount ?? requested - resolved,
  );
  return { requested, resolved, unresolved };
}

/** Texto auxiliar da seção — alinhado ao status derivado de resolvePersistedEvidences. */
export function resolveEvidenceSectionDescription(
  row: WorkbenchRow,
  disabled?: boolean,
): string {
  const adjustment = adjustmentCounts(row);
  const evidenceStatus = resolveEvidenceStatus(row);

  if (
    adjustment.requested > 0 ||
    evidenceStatus === "rejected" ||
    row.validationStatus === "adjustment_requested" ||
    row.proofRequested
  ) {
    if (row.proofRequested && adjustment.requested <= 1) {
      return (
        row.proofRequestObservation?.trim() ||
        "Envie a comprovação solicitada pela administração. A orientação da validação aparece abaixo, quando houver."
      );
    }
    if (adjustment.requested > 1) {
      return `Envie uma nova evidência para cada uma das ${adjustment.requested} devolutivas. Cada substituição será associada a somente uma evidência anterior, preservada no histórico.`;
    }
    return "Envie uma nova evidência conforme a orientação. A versão devolvida será preservada no histórico e substituída automaticamente no reenvio.";
  }
  if (evidenceStatus === "insufficient" || row.validationStatus === "invalidated") {
    return "Consulte as evidências analisadas e a justificativa da decisão administrativa.";
  }
  if (evidenceStatus === "approved" || row.validationStatus === "approved") {
    return "Consulte as evidências aprovadas pela administração.";
  }
  if (disabled) {
    return "Consulte as evidências enviadas. A edição está bloqueada nesta etapa.";
  }
  if (evidenceStatus === "pending") {
    return "Evidência enviada e aguardando validação. Você pode consultar ou gerenciar os itens enviados enquanto o formulário permanecer editável.";
  }
  return "Envie um ou mais arquivos ou informe um link. Cada evidência precisa de um título próprio.";
}
