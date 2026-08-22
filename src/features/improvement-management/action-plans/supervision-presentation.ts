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
    badgeClass: "bg-slate-100 text-slate-700",
  },
  adjustment_request: {
    label: "Solicitação de ajuste",
    description: "Providência solicitada para uma ação específica.",
    icon: AlertCircle,
    badgeClass: "bg-amber-50 text-amber-800",
  },
  opinion: {
    label: "Parecer",
    description: "Análise ou posicionamento institucional.",
    icon: Scale,
    badgeClass: "bg-sky-50 text-sky-800",
  },
  approval: {
    label: "Aceite da execução",
    description: "Valida a ação concluída na revisão registrada.",
    icon: CheckCircle2,
    badgeClass: "bg-emerald-50 text-emerald-800",
  },
  pending: {
    label: "Pendência",
    description: "Bloqueio ou item aguardando providência em uma ação.",
    icon: AlertCircle,
    badgeClass: "bg-rose-50 text-rose-800",
  },
  forwarding: {
    label: "Encaminhamento",
    description: "Direcionamento para outra instância ou responsável.",
    icon: Send,
    badgeClass: "bg-violet-50 text-violet-800",
  },
};

export const SUPERVISION_LIFECYCLE_META: Record<
  SupervisionLifecycleStatus,
  { label: string; icon: LucideIcon; badgeClass: string }
> = {
  recorded: { label: "Registrado", icon: MessageSquare, badgeClass: "bg-slate-100 text-slate-700" },
  open: { label: "Aguardando providência", icon: Clock3, badgeClass: "bg-amber-50 text-amber-800" },
  acknowledged: { label: "Providência informada", icon: Clock3, badgeClass: "bg-sky-50 text-sky-800" },
  resolved: { label: "Resolvido", icon: CheckCircle2, badgeClass: "bg-emerald-50 text-emerald-800" },
  cancelled: { label: "Cancelado", icon: XCircle, badgeClass: "bg-slate-100 text-slate-600" },
  effective: { label: "Aceite vigente", icon: CheckCircle2, badgeClass: "bg-emerald-50 text-emerald-800" },
  superseded: { label: "Aceite superado", icon: XCircle, badgeClass: "bg-amber-50 text-amber-800" },
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
