import { BellRing, ClipboardList, FileBarChart, FileCheck, Lightbulb, ListChecks, Users } from "lucide-react";
import { adminQueueSegmentHref } from "@/features/admin";
import {
  countActiveForms,
  countPendingEvidencesGlobal,
  countPlansInProgressGlobal,
  countRecommendationsGlobal,
  countProfiles,
  countReportsGenerated,
  getAutomationQueueHealth,
} from "@/features/dashboard/queries";
import { MetricCard } from "@/shared/ui/components/metric-card";
import { layout, typography } from "@/shared/layout/design-system";

/** KPIs globais do único administrador da plataforma. */
export async function AdminDashboardKpisSection() {
  const [
    activeForms,
    pendingEvidences,
    recommendationsCount,
    plansInProgress,
    profilesCount,
    reportsCount,
    queueHealth,
  ] = await Promise.all([
      countActiveForms(),
      countPendingEvidencesGlobal(),
      countRecommendationsGlobal(),
      countPlansInProgressGlobal(),
      countProfiles(),
      countReportsGenerated(),
      getAutomationQueueHealth(),
    ]);

  const queueScope = { globalView: true, organizationId: "" };
  const hrefForms = adminQueueSegmentHref("formularios", queueScope, { state: "published" });
  const hrefEvidenciasPending = adminQueueSegmentHref("evidencias", queueScope, {
    status: "submitted",
  });
  const hrefRecomendacoes = adminQueueSegmentHref("recomendacoes", queueScope, {});
  const hrefPlanosEmAndamento = adminQueueSegmentHref("plano-acao", queueScope, { status: "in_progress" });

  return (
    <>
      <section className={layout.sectionStack}>
        <h2 className={typography.sectionTitle}>Visão geral</h2>
        <div className={layout.kpiGrid4}>
          <MetricCard
            label="Formulários ativos"
            value={activeForms}
            icon={ClipboardList}
            variant="info"
            secondary={activeForms === 0 ? "Nenhum formulário publicado" : undefined}
            htmlTitle="Formulários publicados e em uso (exclui rascunhos, encerrados e arquivados)."
            href={hrefForms}
            ctaLabel="Abrir formulários"
          />
          <MetricCard
            label="Evidências aguardando validação"
            value={pendingEvidences}
            icon={FileCheck}
            variant="warning"
            secondary={
              pendingEvidences === 0
                ? undefined
                : `${pendingEvidences} ${pendingEvidences === 1 ? "precisa" : "precisam"} de revisão`
            }
            htmlTitle={pendingEvidences === 0 ? "Nada aguardando validação." : undefined}
            href={hrefEvidenciasPending}
            ctaLabel="Ver fila de evidências"
          />
          <MetricCard
            label="Recomendações"
            value={recommendationsCount}
            icon={Lightbulb}
            variant="info"
            secondary={recommendationsCount === 0 ? undefined : "Geradas pela análise do diagnóstico"}
            htmlTitle={recommendationsCount === 0 ? "Ainda não há recomendações." : undefined}
            href={hrefRecomendacoes}
            ctaLabel="Ver recomendações"
          />
          <MetricCard
            label="Planos em andamento"
            value={plansInProgress}
            icon={ListChecks}
            variant="info"
            secondary={plansInProgress === 0 ? undefined : "Em execução"}
            htmlTitle={plansInProgress === 0 ? "Crie planos a partir de recomendações." : undefined}
            href={hrefPlanosEmAndamento}
            ctaLabel="Ver planos em andamento"
          />
        </div>
      </section>

      <section className={layout.sectionStack}>
        <h2 className={typography.sectionTitle}>Sistema</h2>
        <div className={layout.kpiGrid4}>
          <MetricCard
            label="Usuários cadastrados"
            value={profilesCount}
            icon={Users}
            variant="neutral"
            secondary={profilesCount === 0 ? undefined : "Com acesso à plataforma"}
            htmlTitle="Total de perfis na tabela de usuários."
            href="/admin/usuarios"
            ctaLabel="Gerenciar usuários"
          />
          <MetricCard
            label="Relatórios gerados"
            value={reportsCount}
            icon={FileBarChart}
            variant="info"
            secondary={
              reportsCount === 0
                ? "Gere relatórios oficiais na área de relatórios."
                : "PDFs oficiais já registrados."
            }
            htmlTitle="Registros na tabela de relatórios."
            href="/admin/relatorios"
            ctaLabel="Abrir relatórios"
          />
          <MetricCard
            label="Notificações em fila"
            value={queueHealth.pendingNotifications + queueHealth.processingNotifications}
            icon={BellRing}
            variant={queueHealth.failedNotifications > 0 ? "danger" : queueHealth.pendingNotifications > 0 ? "warning" : "success"}
            status={queueHealth.failedNotifications > 0 ? "critical" : queueHealth.pendingNotifications > 0 ? "attention" : "ok"}
            statusLabel={queueHealth.failedNotifications > 0 ? `${queueHealth.failedNotifications} com falha` : undefined}
            secondary={
              queueHealth.pendingNotifications === 0
                ? "Nenhuma notificação aguardando envio."
                : `${queueHealth.pendingNotifications} aguardando envio.`
            }
            className="bg-slate-50/70 shadow-none"
          />
        </div>
      </section>
    </>
  );
}
