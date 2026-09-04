import { DonutChart } from "@/shared/ui/charts/donut-chart";
import { EVIDENCE_VALIDATION_REGISTRY } from "@/shared/ui/status-registry";

const STATUS_COLORS: Record<string, string> = {
  approved: "#10b981",
  invalidated: "#f43f5e",
  adjustment_requested: "#f59e0b",
  pending: "#94a3b8",
  submitted: "#38bdf8",
  sem_evidencia: "#cbd5e1",
};

const PLURAL_LABEL: Record<string, string> = {
  approved: "Aprovadas",
  invalidated: "Não aprovadas",
  adjustment_requested: "Ajuste solicitado",
  pending: "Aguardando envio do diagnóstico",
  submitted: "Aguardando validação",
  sem_evidencia: "Sem evidência",
};

function statusChartLabel(status: string): string {
  if (status in PLURAL_LABEL) {
    return PLURAL_LABEL[status as keyof typeof PLURAL_LABEL]!;
  }
  const hit = EVIDENCE_VALIDATION_REGISTRY[status as keyof typeof EVIDENCE_VALIDATION_REGISTRY];
  return hit?.label ?? status;
}

export function StatusPieChart({ data }: { data: Record<string, number> }) {
  const slices = Object.entries(data).map(([status, value]) => ({
    key: status,
    label: statusChartLabel(status),
    value,
    color: STATUS_COLORS[status] ?? "#cbd5e1",
  }));
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <DonutChart
      slices={slices}
      centerValue={total}
      centerLabel="evidências"
      ariaLabel="Situação das evidências"
      emptyTitle="Nenhuma evidência com validação"
      emptyDescription="A distribuição aparece quando houver validações."
    />
  );
}
