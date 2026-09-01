"use client";

import { formatPlatformDate } from "@/shared/datetime/platform-date-time";
import { ClipboardCopy } from "lucide-react";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { formSurface } from "@/shared/layout/form-surface";
import { layout } from "@/shared/layout/design-system";
import { notify } from "@/infrastructure/notifications/notify";
import { copyTextToClipboard } from "@/shared/browser/clipboard";
import { recommendationTypeLabel } from "@/shared/ui/status-registry";
import { OverviewContentBlock } from "./overview-content-block";
import { useRecommendationDetailContext } from "./recommendation-detail-context";

function formatDate(value: string | undefined | null): string {
  return formatPlatformDate(value, { day: "2-digit", month: "short", year: "numeric" });
}

/** Página documental da recomendação — contexto, texto oficial e relação com o próximo diagnóstico. */
export function RecommendationDocumentPanel() {
  const ctx = useRecommendationDetailContext();
  const row = ctx.row;

  if (!row) return null;

  async function copyRecommendation() {
    const copied = await copyTextToClipboard(row?.recommendationText?.trim() || "");
    if (copied) {
      notify.success("Texto copiado.");
      return;
    }
    notify.error("Não foi possível copiar.");
  }

  return (
    <div className={layout.panelStack}>
      <PanelSection
        title="Contexto"
        description="Origem institucional desta recomendação."
        variant="card"
        contentClassName="space-y-5"
      >
        <OverviewContentBlock title="Origem" description="Formulário, organização e classificação.">
          <dl className="grid gap-x-5 gap-y-2.5 text-sm sm:grid-cols-2">
            {row.questionPrompt ? (
              <div className="sm:col-span-2">
                <dt className={formSurface.label}>Critério de origem</dt>
                <dd className="mt-0.5 leading-relaxed text-slate-800">{row.questionPrompt}</dd>
              </div>
            ) : null}
            <div>
              <dt className={formSurface.label}>Eixo</dt>
              <dd className="mt-0.5 text-slate-800">{row.axisName || "—"}</dd>
            </div>
            <div>
              <dt className={formSurface.label}>Seção</dt>
              <dd className="mt-0.5 text-slate-800">{row.sectionName || "—"}</dd>
            </div>
            <div>
              <dt className={formSurface.label}>Formulário</dt>
              <dd className="mt-0.5 text-slate-800">
                {row.formName}
                {ctx.role === "admin" ? (
                  <span className="tabular-nums text-slate-400"> v{row.formVersion}</span>
                ) : null}
              </dd>
            </div>
            {ctx.role === "admin" ? (
              <div>
                <dt className={formSurface.label}>Organização</dt>
                <dd className="mt-0.5 text-slate-800">{row.organizationName}</dd>
              </div>
            ) : null}
            <div>
              <dt className={formSurface.label}>Gerada em</dt>
              <dd className="mt-0.5 tabular-nums text-slate-800">
                {row.recommendationCreatedAt ? formatDate(row.recommendationCreatedAt) : "—"}
              </dd>
            </div>
            <div>
              <dt className={formSurface.label}>Classificação</dt>
              <dd className="mt-0.5 text-slate-800">
                {recommendationTypeLabel(row.recommendationType)}
              </dd>
            </div>
          </dl>
        </OverviewContentBlock>
      </PanelSection>

      <PanelSection
        title="Recomendação oficial"
        description="Texto institucional a ser executado pela organização."
        variant="card"
      >
        <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-4 text-sm leading-relaxed text-slate-800">
          <p className="whitespace-pre-wrap">{row.recommendationText || "(sem texto)"}</p>
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-600 transition hover:text-slate-900"
            onClick={() => void copyRecommendation()}
          >
            <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
            Copiar texto completo
          </button>
        </div>
      </PanelSection>

      <PanelSection
        title="Relação com o próximo diagnóstico"
        description="Relação com eixo estrutural e maturidade institucional."
        variant="card"
        contentClassName="space-y-5"
      >
        <p className="rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3.5 text-sm leading-relaxed text-slate-600">
          Esta recomendação está vinculada ao eixo{" "}
          <strong className="font-medium text-slate-800">{row.axisName || "estrutural"}</strong>{" "}
          ({recommendationTypeLabel(row.recommendationType)}).
        </p>
        <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-4">
          <p className={formSurface.label}>Efeito esperado</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            A execução do plano de integridade e compliance pode contribuir para melhores resultados em um próximo
            diagnóstico. Ela não altera o resultado FAMI já concluído.
          </p>
        </div>
      </PanelSection>
    </div>
  );
}
