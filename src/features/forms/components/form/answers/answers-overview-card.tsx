import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import { MetricCard } from "@/shared/ui/components/metric-card";
import type { AnswersOverview } from "@/features/forms/answers-types";

function formatDate(iso: string | null): string {
  return formatPlatformDateTime(
    iso,
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
    iso || "—",
  );
}

/** Indicadores da aba Respostas — sem ícones decorativos, alinhados aos KPIs da plataforma. */
export function AnswersOverviewCard({ overview }: { overview: AnswersOverview }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        variant="neutral"
        density="compact"
        label="Total de respondentes"
        value={overview.totalRespondents}
        secondary="Organizações com pelo menos uma resposta."
      />
      <MetricCard
        variant="neutral"
        density="compact"
        label="Diagnósticos"
        value={overview.totalCycles}
        secondary="Execuções preservadas por período."
      />
      <MetricCard
        variant="info"
        density="compact"
        label="Última resposta"
        value={overview.lastAnswerAt ? formatDate(overview.lastAnswerAt) : "—"}
        valueClassName="mt-3 text-base font-semibold leading-snug text-slate-900"
        secondary="Mais recente entre todas as organizações."
      />
      <MetricCard
        variant="neutral"
        density="compact"
        label="Perguntas"
        value={overview.totalQuestions}
        secondary="Total configurado neste formulário."
      />
    </div>
  );
}
