import { formatPlatformDate, formatPlatformTime } from "@/shared/datetime/platform-date-time";
import Link from "next/link";
import { AlertTriangle, Check, Clock3, Eye, FileText, PencilLine, TrendingUp } from "lucide-react";
import type { CycleState } from "@/shared/domain/types";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";

type ConfirmedSubmissionState = Exclude<CycleState, "draft" | "in_response">;

type Props = {
  cycleId: string;
  formName: string;
  periodLabel: string;
  submittedAt: string;
  submittedLateAt?: string | null;
  submissionDelaySeconds?: number | null;
  state: ConfirmedSubmissionState;
  diagnosesHref: string;
  submissionKind?: "diagnostic" | "corrections";
};

type StateCopy = {
  pageTitle: string;
  introduction: string;
  label: string;
  description: string;
  actionLabel: string;
  actionIcon: typeof Eye;
  actionHref: (cycleId: string, diagnosesHref: string) => string;
  statusIcon: typeof Eye;
  iconClassName: string;
  messageClassName: string;
  cardClassName: string;
};

const STATUS_COPY: Record<ConfirmedSubmissionState, StateCopy> = {
  submitted: {
    pageTitle: "Diagnóstico enviado para validação",
    introduction:
      "Suas respostas e evidências foram enviadas com sucesso. Você receberá uma notificação quando a validação começar ou quando houver uma devolutiva.",
    label: "Aguardando validação",
    description: "O diagnóstico foi recebido e aguarda o início da validação administrativa.",
    actionLabel: "Ver respostas enviadas",
    actionIcon: Eye,
    actionHref: (cycleId, diagnosesHref) =>
      `/respondente/ciclos/${encodeURIComponent(cycleId)}?returnTo=${encodeURIComponent(diagnosesHref)}`,
    statusIcon: Check,
    iconClassName: "bg-emerald-100 text-emerald-700 ring-emerald-50",
    messageClassName: formSurface.messageSuccess,
    cardClassName: "border-emerald-200/80",
  },
  in_validation: {
    pageTitle: "Diagnóstico em validação",
    introduction:
      "A administração iniciou a análise das respostas e evidências. Neste momento, o conteúdo permanece disponível apenas para consulta.",
    label: "Em validação",
    description: "A administração já iniciou a validação das respostas e evidências enviadas.",
    actionLabel: "Acompanhar validação",
    actionIcon: Eye,
    actionHref: (cycleId, diagnosesHref) =>
      `/respondente/ciclos/${encodeURIComponent(cycleId)}?returnTo=${encodeURIComponent(diagnosesHref)}`,
    statusIcon: Clock3,
    iconClassName: "bg-brand-100 text-brand-700 ring-brand-50",
    messageClassName: formSurface.messageNeutral,
    cardClassName: "border-brand-200/80",
  },
  awaiting_adjustment: {
    pageTitle: "Correções solicitadas",
    introduction:
      "A administração devolveu itens que precisam de correção. Abra o diagnóstico, consulte cada orientação e reenvie quando todas as pendências estiverem resolvidas.",
    label: "Correções solicitadas",
    description: "O diagnóstico está novamente disponível para edição dos itens devolvidos.",
    actionLabel: "Corrigir pendências",
    actionIcon: PencilLine,
    actionHref: (cycleId, diagnosesHref) =>
      `/respondente/ciclos/${encodeURIComponent(cycleId)}?returnTo=${encodeURIComponent(diagnosesHref)}`,
    statusIcon: AlertTriangle,
    iconClassName: "bg-amber-100 text-amber-700 ring-amber-50",
    messageClassName: formSurface.messageWarning,
    cardClassName: "border-amber-200/80",
  },
  validated: {
    pageTitle: "Diagnóstico validado",
    introduction:
      "A validação foi concluída. Consulte o resultado FAMI e as recomendações oficiais antes de organizar o plano de integridade e compliance.",
    label: "Validação concluída",
    description: "O resultado FAMI e as recomendações oficiais já estão disponíveis.",
    actionLabel: "Ver Resultado FAMI",
    actionIcon: TrendingUp,
    actionHref: (cycleId) =>
      `/respondente/pontuacao-fami?cycleId=${encodeURIComponent(cycleId)}`,
    statusIcon: TrendingUp,
    iconClassName: "bg-emerald-100 text-emerald-700 ring-emerald-50",
    messageClassName: formSurface.messageSuccess,
    cardClassName: "border-emerald-200/80",
  },
  completed: {
    pageTitle: "Avaliação encerrada",
    introduction:
      "Todas as etapas administrativas do diagnóstico foram encerradas. O resultado permanece disponível e o relatório oficial poderá ser consultado após a emissão.",
    label: "Ciclo concluído",
    description: "A avaliação foi encerrada e não aceita novas alterações nas respostas.",
    actionLabel: "Ver relatórios",
    actionIcon: FileText,
    actionHref: (cycleId) =>
      `/respondente/relatorios?cycleId=${encodeURIComponent(cycleId)}`,
    statusIcon: FileText,
    iconClassName: "bg-slate-100 text-slate-700 ring-slate-50",
    messageClassName: formSurface.messageNeutral,
    cardClassName: "border-slate-200",
  },
};

const CORRECTIONS_RESUBMITTED_COPY: StateCopy = {
  pageTitle: "Correções reenviadas para validação",
  introduction:
    "As novas evidências foram reenviadas com sucesso. A administração poderá revisar cada correção e concluir a validação ou solicitar um novo ajuste.",
  label: "Correções em validação",
  description: "As evidências corrigidas foram recebidas e estão novamente em análise administrativa.",
  actionLabel: "Acompanhar correções",
  actionIcon: Eye,
  actionHref: (cycleId, diagnosesHref) =>
    `/respondente/ciclos/${encodeURIComponent(cycleId)}?returnTo=${encodeURIComponent(diagnosesHref)}`,
  statusIcon: Check,
  iconClassName: "bg-emerald-100 text-emerald-700 ring-emerald-50",
  messageClassName: formSurface.messageSuccess,
  cardClassName: "border-emerald-200/80",
};

export function formatSubmissionDateTime(iso: string): string {
  const date = formatPlatformDate(
    iso,
    { day: "2-digit", month: "2-digit", year: "numeric" },
    "",
  );
  const time = formatPlatformTime(
    iso,
    { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
    "",
  );
  return date && time ? `${date} às ${time}` : "Data indisponível";
}

export function formatSubmissionDelay(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(safeSeconds / 86_400);
  const hours = Math.floor((safeSeconds % 86_400) / 3_600);
  const minutes = Math.floor((safeSeconds % 3_600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} dia${days === 1 ? "" : "s"}`);
  if (hours > 0) parts.push(`${hours} hora${hours === 1 ? "" : "s"}`);
  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes} minuto${minutes === 1 ? "" : "s"}`);
  }
  return parts.slice(0, 2).join(" e ");
}

export function RespondentSubmissionConfirmation({
  cycleId,
  formName,
  periodLabel,
  submittedAt,
  submittedLateAt = null,
  submissionDelaySeconds = null,
  state,
  diagnosesHref,
  submissionKind = "diagnostic",
}: Props) {
  const status =
    submissionKind === "corrections" && state === "in_validation"
      ? CORRECTIONS_RESUBMITTED_COPY
      : STATUS_COPY[state];
  const ActionIcon = status.actionIcon;
  const StatusIcon = status.statusIcon;
  const actionHref = status.actionHref(cycleId, diagnosesHref);

  return (
    <main className={`${formSurface.formWorkspace.inner} py-4 sm:py-8`}>
      <article className={`overflow-hidden rounded-2xl border bg-white shadow-popover ring-1 ring-slate-900/[0.04] ${status.cardClassName}`}>
        <div className="border-b border-slate-200 bg-white px-6 py-8 text-center sm:px-10 sm:py-10">
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ring-8 ${status.iconClassName}`}>
            <StatusIcon className="h-8 w-8" strokeWidth={2.5} aria-hidden />
          </div>
          <h1 className={`mt-6 text-pretty ${typography.pageTitle}`}>
            {status.pageTitle}
          </h1>
          <p className={`mx-auto max-w-2xl ${typography.pageDescription}`}>
            {status.introduction}
          </p>
        </div>

        <div className="space-y-6 px-6 py-6 sm:px-10 sm:py-8">
          <dl className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2 sm:p-5">
            <div>
              <dt className={formSurface.label}>Diagnóstico</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{formName}</dd>
              <dd className="mt-0.5 text-xs text-slate-500">{periodLabel}</dd>
            </div>
            <div>
              <dt className={formSurface.label}>Último envio</dt>
              <dd className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-900">
                <Clock3 className="h-4 w-4 text-slate-500" aria-hidden />
                <time dateTime={submittedAt}>{formatSubmissionDateTime(submittedAt)}</time>
              </dd>
              <dd className="mt-0.5 text-xs text-slate-500">Horário de Fortaleza (UTC−3)</dd>
            </div>
          </dl>

          <div role="status" className={status.messageClassName}>
            <p className="font-medium">{status.label}</p>
            <p className="mt-1 leading-relaxed">{status.description}</p>
          </div>

          {submittedLateAt && submissionDelaySeconds != null ? (
            <div role="note" className={formSurface.messageWarning}>
              <p className="font-medium">Envio realizado após o prazo</p>
              <p className="mt-1 leading-relaxed">
                O diagnóstico foi recebido normalmente. Para fins de acompanhamento, o sistema registrou atraso de {formatSubmissionDelay(submissionDelaySeconds)}.
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href={diagnosesHref} className={`${formSurface.secondaryButton} sm:min-w-56`}>
              Voltar aos meus diagnósticos
            </Link>
            <Link href={actionHref} className={`${formSurface.primaryButton} sm:min-w-52`}>
              <ActionIcon className="h-4 w-4" aria-hidden />
              {status.actionLabel}
            </Link>
          </div>
        </div>
      </article>
    </main>
  );
}
