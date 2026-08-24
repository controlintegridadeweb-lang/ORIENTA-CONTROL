import Link from "next/link";
import type { CycleListItem } from "@/features/cycles/cycle-queries";
import { CycleActions } from "@/features/cycles/components/CycleActions";
import { CycleCloseActions } from "@/features/cycles/components/cycle-close-actions";
import type { ActionPlanCompletionReadiness } from "@/features/improvement-management";
import { ADMIN_CYCLE_STATE_LABEL } from "@/shared/domain/cycle-labels";
import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import { layout } from "@/shared/layout/design-system";
import { formSurface } from "@/shared/layout/form-surface";
import {
  adminReturnLabel,
  adminReturnPathOrFallback,
} from "@/shared/navigation/admin-navigation-context";
import { adminFamiPath } from "@/shared/navigation/fami-paths";
import { queryPath } from "@/shared/navigation/query-path";
import { PageHeader } from "@/shared/ui/components/page-header";
import { countLabel } from "@/shared/format/count-label";
import type { ReportLifecycleStatus } from "@/shared/domain/report-lifecycle";

function validationNotice(flag: string | undefined): string | null {
  if (flag === "adjustment_requested") return "Ajuste solicitado à organização.";
  if (flag === "consolidated") return "Validação concluída e resultado FAMI calculado.";
  return null;
}

function ContextItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-700">{value}</dd>
    </div>
  );
}

export function AdminCycleDetail({
  cycle,
  returnTo,
  validationFlag,
  completionReadiness,
  reportLifecycleStatus,
}: {
  cycle: CycleListItem;
  returnTo?: string | null;
  validationFlag?: string;
  completionReadiness: ActionPlanCompletionReadiness | null;
  reportLifecycleStatus: ReportLifecycleStatus | null;
}) {
  const backHref = adminReturnPathOrFallback(
    returnTo,
    `/admin/ciclos?formId=${encodeURIComponent(cycle.formId)}`,
  );
  const notice = validationNotice(validationFlag);
  const showOfficialResult = cycle.state === "validated" || cycle.state === "completed";
  const organizationLabel = cycle.organizationAcronym
    ? `${cycle.organizationAcronym} — ${cycle.organizationName}`
    : cycle.organizationName;

  return (
    <div className={layout.pageStack}>
      <p className="text-sm text-slate-500">
        <Link href={backHref} className="text-brand-700 hover:underline">
          {adminReturnLabel(backHref)}
        </Link>
      </p>

      <PageHeader
        title={organizationLabel}
        description={`${cycle.formName} · ${cycle.periodLabel}`}
      />

      <dl className="grid gap-3 border-b border-slate-200 pb-5 text-sm text-slate-500 sm:grid-cols-2 lg:grid-cols-4 sm:pb-6">
        <ContextItem label="Organização" value={organizationLabel} />
        <ContextItem label="Diagnóstico" value={cycle.formName} />
        <ContextItem label="Período" value={cycle.periodLabel} />
        <ContextItem label="Situação" value={ADMIN_CYCLE_STATE_LABEL[cycle.state]} />
        {cycle.reopenCount > 0 ? (
          <ContextItem
            label="Reaberturas"
            value={countLabel(cycle.reopenCount, "reabertura", "reaberturas")}
          />
        ) : null}
      </dl>

      {cycle.responseDeadlineAt ? (
        <p className="text-sm text-slate-500">
          Prazo de resposta:{" "}
          <time dateTime={cycle.responseDeadlineAt}>
            {formatPlatformDateTime(cycle.responseDeadlineAt)}
          </time>
        </p>
      ) : null}

      {notice ? (
        <p role="status" className={formSurface.messageSuccess}>
          {notice}
        </p>
      ) : null}

      {showOfficialResult ? (
        <div className="flex flex-wrap gap-2">
          <Link
            href={adminFamiPath({
              organizationId: cycle.organizationId,
              formId: cycle.formId,
              cycleId: cycle.id,
            })}
            className={formSurface.primaryButtonSm}
          >
            Ver Resultado FAMI
          </Link>
          <Link
            href={queryPath("/admin/recomendacoes", { cycleId: cycle.id })}
            className={formSurface.secondaryButtonSm}
          >
            Ver recomendações
          </Link>
        </div>
      ) : null}

      <div className={formSurface.card}>
        <div className={formSurface.body}>
          <CycleActions cycle={cycle} reportLifecycleStatus={reportLifecycleStatus} />
          <CycleCloseActions cycle={cycle} completionReadiness={completionReadiness} />
        </div>
      </div>
    </div>
  );
}
