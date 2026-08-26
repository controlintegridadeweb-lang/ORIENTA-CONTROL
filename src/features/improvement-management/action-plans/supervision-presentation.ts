import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  MessageSquare,
  Scale,
  Send,
  XCircle,
} from "lucide-react";
import type {
  SupervisionLifecycleStatus,
  SupervisionNoteComposerType,
  SupervisionNoteType,
} from "./schemas";
import { formSurface } from "@/shared/layout/form-surface";

export type SupervisionNoteMeta = {
  label: string;
  description: string;
  icon: LucideIcon;
  badgeClass: string;
};

export const SUPERVISION_NOTE_META: Record<SupervisionNoteType, SupervisionNoteMeta> = {
  comment: {
    label: "Comentário",
    description: "Observação geral de acompanhamento.",
    icon: MessageSquare,
    badgeClass: formSurface.badge.neutral,
  },
  adjustment_request: {
    label: "Solicitação de ajuste",
    description: "Providência solicitada para uma ação específica.",
    icon: AlertCircle,
    badgeClass: formSurface.badge.warning,
  },
  opinion: {
    label: "Parecer",
    description: "Análise ou posicionamento institucional.",
    icon: Scale,
    badgeClass: formSurface.badge.info,
  },
  approval: {
    label: "Aceite da execução",
    description: "Valida a ação concluída na revisão registrada.",
    icon: CheckCircle2,
    badgeClass: formSurface.badge.success,
  },
  pending: {
    label: "Pendência",
    description: "Bloqueio ou item aguardando providência em uma ação.",
    icon: AlertCircle,
    badgeClass: formSurface.badge.danger,
  },
  forwarding: {
    label: "Encaminhamento",
    description: "Direcionamento para outra instância ou responsável.",
    icon: Send,
    badgeClass: formSurface.badge.muted,
  },
};

export const SUPERVISION_LIFECYCLE_META: Record<
  SupervisionLifecycleStatus,
  { label: string; icon: LucideIcon; badgeClass: string }
> = {
  recorded: { label: "Registrado", icon: MessageSquare, badgeClass: formSurface.badge.neutral },
  open: { label: "Aguardando providência", icon: Clock3, badgeClass: formSurface.badge.warning },
  acknowledged: { label: "Providência informada", icon: Clock3, badgeClass: formSurface.badge.info },
  resolved: { label: "Resolvido", icon: CheckCircle2, badgeClass: formSurface.badge.success },
  cancelled: { label: "Cancelado", icon: XCircle, badgeClass: formSurface.badge.muted },
  effective: { label: "Aceite vigente", icon: CheckCircle2, badgeClass: formSurface.badge.success },
  superseded: { label: "Aceite superado", icon: XCircle, badgeClass: formSurface.badge.warning },
};

/** Registros que o administrador pode criar no monitoramento de uma ação. */
export const MONITORING_COMPOSER_TYPES = [
  "comment",
  "opinion",
  "pending",
  "forwarding",
  "adjustment_request",
  "approval",
] as const satisfies readonly SupervisionNoteComposerType[];

export const MONITORING_COMPOSER_TYPE_LABELS: Record<
  (typeof MONITORING_COMPOSER_TYPES)[number],
  string
> = {
  comment: "Comentário",
  opinion: "Parecer / orientação",
  pending: "Pendência",
  forwarding: "Encaminhamento",
  adjustment_request: "Solicitação de ajuste",
  approval: "Decisão / aceite",
};
