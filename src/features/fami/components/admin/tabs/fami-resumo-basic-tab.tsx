"use client";

import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import Link from "next/link";
import type { FamiSnapshotResponse } from "@/features/fami/client";
import { typography } from "@/shared/layout/design-system";
import { PanelSection } from "@/shared/ui/components/panel-section";
import {
  FAMI_SECTION_STACK,
  type FamiMode,
  type FamiSnapshotNonNull,
  type QueueHrefFn,
} from "../fami-maturity-helpers";

type Props = {
  snapshot: FamiSnapshotNonNull;
  data: FamiSnapshotResponse | null;
  mode: FamiMode;
  organizationId: string;
  effectiveFormId: string;
  queueHref: QueueHrefFn;
};

/** Panorama básico (legado / modo compartilhado): visão global + atalhos. Análise por eixo fica na tab “Por eixo”. */
export function FamiResumoBasicTab({
  snapshot,
  data,
  mode,
  organizationId,
  effectiveFormId,
  queueHref,
}: Props) {
  return (
    <div className={FAMI_SECTION_STACK}>
      {organizationId && effectiveFormId && mode === "admin" ? (
        <nav
          className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-slate-200/80 bg-white px-5 py-4 shadow-card"
          aria-label="Atalhos operacionais"
        >
          <Link
            href={queueHref("evidencias", { formId: effectiveFormId }) ?? "#"}
            className={typography.inlineNavLink}
          >
            Fila de evidências
          </Link>
          <Link
            href={queueHref("recomendacoes", { formId: effectiveFormId }) ?? "#"}
            className={typography.inlineNavLink}
          >
            Recomendações deste formulário
          </Link>
          <Link
            href={queueHref("plano-acao", { formId: effectiveFormId }) ?? "#"}
            className={typography.inlineNavLink}
          >
            Plano de integridade e compliance
          </Link>
        </nav>
      ) : null}

      {snapshot.global ? (
        <PanelSection
          title="Visão global"
          description="Consolidado de maturidade no escopo selecionado."
          variant="card"
        >
          <p className={typography.metricLabel}>Maturidade consolidada</p>
          <p className={`mt-2.5 ${typography.metricValue}`}>
            {snapshot.global.maturityLevel == null
              ? "N/A"
              : `${snapshot.global.percentage.toFixed(1)}%`}
          </p>
          <p className={`mt-2.5 ${typography.metricSecondary}`}>
            {snapshot.global.maturityLevel == null
              ? "Sem critérios aplicáveis ao FAMI neste diagnóstico"
              : `Nível ${snapshot.global.maturityLevel} · Pontos ${snapshot.global.pointsObtained.toFixed(2)} / ${snapshot.global.pointsPossible.toFixed(2)} pontos possíveis`}
          </p>
          {data?.latestVersionMeta?.createdAt ? (
            <p className={`mt-2 ${typography.metricSecondary}`}>
              Processado em{" "}
              {formatPlatformDateTime(data.latestVersionMeta.createdAt, { dateStyle: "short", timeStyle: "short" })}
            </p>
          ) : null}
        </PanelSection>
      ) : null}
    </div>
  );
}
