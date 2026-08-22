import type { LucideIcon } from "lucide-react";
import { EVIDENCE_VALIDATION_REGISTRY } from "@/shared/ui/status-registry";
import type { ValidationStatus } from "./schemas";

/** Grupo operacional para KPIs, filtros e exportações. */
type EvidenceStatusKpiGroup =
  | "aguardando_envio"
  | "aguardando_validacao"
  | "ajuste_solicitado"
  | "aprovadas"
  | "nao_aprovadas";

/** Classificação visual por status de validação. */
export type EvidenceVisualGroup = EvidenceStatusKpiGroup;

/**
 * Mantém separadas as situações que dependem da equipe validadora e as que
 * dependem da organização. “Ajuste solicitado” nunca é contado como
 * “Aguardando validação”.
 */
export function statusToVisualGroup(status: ValidationStatus): EvidenceVisualGroup | null {
  switch (status) {
    case "pending":
      return "aguardando_envio";
    case "submitted":
      return "aguardando_validacao";
    case "not_required":
      return null;
    case "adjustment_requested":
      return "ajuste_solicitado";
    case "approved":
      return "aprovadas";
    case "invalidated":
      return "nao_aprovadas";
  }
}

/** Contagem para o painel, sem agrupamentos semanticamente distintos. */
export function aggregateKpiCounts(items: { currentStatus: ValidationStatus }[]): {
  total: number;
  aguardando_envio: number;
  aguardando_validacao: number;
  ajuste_solicitado: number;
  aprovadas: number;
  nao_aprovadas: number;
} {
  const counts = {
    total: items.length,
    aguardando_envio: 0,
    aguardando_validacao: 0,
    ajuste_solicitado: 0,
    aprovadas: 0,
    nao_aprovadas: 0,
  };

  for (const { currentStatus } of items) {
    const group = statusToVisualGroup(currentStatus);
    if (group) counts[group] += 1;
  }
  return counts;
}

const VALIDATION_VARIANT: Record<
  ValidationStatus,
  "neutral" | "success" | "danger" | "warning" | "info" | "muted"
> = {
  not_required: "muted",
  pending: "warning",
  submitted: "warning",
  approved: "success",
  invalidated: "danger",
  adjustment_requested: "warning",
};

export const STATUS_BADGE_META: Record<
  ValidationStatus,
  {
    label: string;
    variant: "neutral" | "success" | "danger" | "warning" | "info" | "muted";
    icon: LucideIcon;
  }
> = Object.fromEntries(
  (Object.keys(EVIDENCE_VALIDATION_REGISTRY) as ValidationStatus[]).map((key) => {
    const entry = EVIDENCE_VALIDATION_REGISTRY[key];
    return [
      key,
      {
        label: entry.label,
        variant: VALIDATION_VARIANT[key],
        icon: entry.icon!,
      },
    ];
  }),
) as Record<
  ValidationStatus,
  {
    label: string;
    variant: "neutral" | "success" | "danger" | "warning" | "info" | "muted";
    icon: LucideIcon;
  }
>;
