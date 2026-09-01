import type { RecommendationListItem } from "@/features/improvement-management/recommendations/admin-service";
import { RECOMMENDATION_STATUS_LABELS } from "@/shared/ui/status-registry";
import { formSurface } from "@/shared/layout/form-surface";

type Props = {
  item: RecommendationListItem;
};

/**
 * A recomendação é congelada no processamento do diagnóstico. Sua situação é
 * derivada do plano de integridade e compliance; por isso esta área é somente de acompanhamento.
 */
export function RecommendationActions({ item }: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 ring-1 ring-slate-100/80">
        <p className={formSurface.label}>Situação da recomendação</p>
        <p className="mt-2 text-sm font-semibold text-slate-900">
          {RECOMMENDATION_STATUS_LABELS[item.status]}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Esta situação é atualizada a partir do plano de integridade e compliance vinculado. Para
          alterar o andamento, cadastre ou atualize as ações do plano.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/70">
        <p className={formSurface.label}>Texto da recomendação</p>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
          {item.currentText}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          O texto foi congelado quando o diagnóstico foi consolidado para manter
          a rastreabilidade do resultado e do relatório.
        </p>
      </div>
    </div>
  );
}
