"use client";

import { typography } from "@/shared/layout/design-system";
import type { ReportLifecycleStatus } from "@/shared/domain/report-lifecycle";

import Link from "next/link";
import type { ReactNode } from "react";
import type { CycleListItem } from "@/features/cycles/cycle-queries";
import { formSurface } from "@/shared/layout/form-surface";
import { PLATFORM_TIME_ZONE_LABEL } from "@/shared/datetime/fortaleza-date-time";
import { LoadingButton } from "@/shared/ui/components/loading";
import { ReopenValidationModal } from "./reopen-validation-modal";
import { useCycleActionsController } from "./use-cycle-actions-controller";

function CycleActionSection({
  title,
  description,
  action,
  children,
  error,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children?: ReactNode;
  error?: string | null;
}) {
  return (
    <div className="mt-5 border-t border-slate-200 pt-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className={typography.cardTitle}>{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
          {error ? <p role="alert" className={`mt-2 ${formSurface.messageError}`}>{error}</p> : null}
          {children ? <div className="mt-4 space-y-3">{children}</div> : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-start gap-2">{action}</div> : null}
      </div>
    </div>
  );
}

export function CycleActions({
  cycle,
  reportLifecycleStatus = null,
}: {
  cycle: CycleListItem;
  reportLifecycleStatus?: ReportLifecycleStatus | null;
}) {
  const controller = useCycleActionsController(cycle);
  const { state, patch, current, busy, reopenValidationTarget } = controller;
  const lateNotice = cycle.submittedLateAt && cycle.submissionDelaySeconds != null ? (
    <p className="text-sm leading-relaxed text-slate-600">
      O último envio ocorreu após o prazo e o atraso ficou registrado na auditoria.
    </p>
  ) : null;
  const reopenModal = reopenValidationTarget ? (
    <ReopenValidationModal
      key={state.reopenValidationModalKey}
      open={state.reopenValidationModalOpen}
      pending={state.transitioningTo === "in_validation"}
      impact={state.reopenValidationImpact}
      impactLoading={state.reopenValidationImpactLoading}
      onClose={() => {
        if (state.transitioningTo !== "in_validation") patch({ reopenValidationModalOpen: false });
      }}
      onConfirm={controller.confirmReopenValidation}
    />
  ) : null;

  if (current === "validated" && reopenValidationTarget) {
    return (
      <>
        <CycleActionSection
          title="Validação"
          description="O diagnóstico possui um Resultado FAMI oficial."
          error={state.error}
          action={
            <LoadingButton
              type="button"
              pending={false}
              disabled={busy}
              onClick={() => void controller.openReopenValidationModal()}
              className={formSurface.secondaryButtonSm}
            >
              Reabrir validação
            </LoadingButton>
          }
        />
        {reopenModal}
      </>
    );
  }

  if (current === "in_validation") {
    return (
      <CycleActionSection
        title="Validação"
        description="Avalie as evidências e as respostas “Não se aplica”. Conclua a validação na fila quando não houver pendências."
        error={state.error}
        action={<Link href={controller.validationQueueHref} className={formSurface.secondaryButtonSm}>Revisar validação do diagnóstico</Link>}
      >
        {lateNotice}
      </CycleActionSection>
    );
  }

  if (current === "in_response" || current === "awaiting_adjustment") {
    return (
      <CycleActionSection
        title={current === "in_response" ? "Aguardando envio" : "Aguardando correção"}
        description={current === "in_response"
          ? "O diagnóstico avançará quando a organização concluir todas as respostas e realizar o envio. A ausência de evidência exigida será registrada como não conformidade na validação."
          : "A retomada da validação ocorre automaticamente pelo fluxo de reenvio, após a organização resolver as pendências solicitadas."}
        error={state.error}
      >
        {lateNotice}
      </CycleActionSection>
    );
  }

  if (current === "draft") return <DraftCycleActions controller={controller} />;
  if (current === "completed") {
    return (
      <CompletedCycleActions
        controller={controller}
        cycleId={cycle.id}
        organizationId={cycle.organizationId}
        reportLifecycleStatus={reportLifecycleStatus}
      />
    );
  }

  return (
    <>
      <CycleActionSection
        title="Ações"
        description="Avance o diagnóstico conforme a etapa atual."
        error={state.error}
        action={<TransitionButtons controller={controller} />}
      >
        {lateNotice}
      </CycleActionSection>
      {reopenModal}
    </>
  );
}

function DraftCycleActions({ controller }: { controller: ReturnType<typeof useCycleActionsController> }) {
  const { state, patch, busy, hasPersistedSchedule, otherBoundaryTargets } = controller;
  const openTarget = otherBoundaryTargets.find((target) => target.effect === "open");
  return (
    <CycleActionSection
      title="Abertura"
      description={`Defina o cronograma e abra o diagnóstico para respostas. Datas no ${PLATFORM_TIME_ZONE_LABEL}.`}
      error={state.error}
      action={openTarget ? (
        <LoadingButton
          type="button"
          pending={state.transitioningTo === openTarget.to}
          pendingLabel={`${openTarget.label}…`}
          disabled={busy || !hasPersistedSchedule}
          onClick={() => void controller.runTransition(openTarget.to, openTarget.label, openTarget.effect)}
          className={formSurface.secondaryButtonSm}
        >
          {openTarget.label}
        </LoadingButton>
      ) : null}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <ScheduleInput label="Início" value={state.startsAt} onChange={(startsAt) => patch({ startsAt })} />
        <ScheduleInput label="Prazo de resposta" value={state.deadlineAt} onChange={(deadlineAt) => patch({ deadlineAt })} />
        <ScheduleInput
          label="Conclusão automática, se a validação estiver pronta"
          value={state.validationDeadlineAt}
          onChange={(validationDeadlineAt) => patch({ validationDeadlineAt })}
          hint="Opcional; só conclui quando o diagnóstico estiver em validação e sem pendências."
        />
        <ScheduleInput
          label="Encerramento automático da avaliação"
          value={state.cycleCloseAt}
          onChange={(cycleCloseAt) => patch({ cycleCloseAt })}
          hint="Opcional; exige validação programada."
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <LoadingButton
          type="button"
          pending={state.savingSchedule}
          pendingLabel="Salvando datas…"
          disabled={busy}
          onClick={() => void controller.saveSchedule()}
          className={formSurface.secondaryButtonSm}
        >
          Salvar datas
        </LoadingButton>
        {!hasPersistedSchedule ? <p className="text-xs text-slate-500">Salve início e prazo de resposta para liberar a abertura.</p> : null}
      </div>
      <p className="text-xs leading-relaxed text-slate-500">
        O sistema permite envio após o prazo e registra o atraso automaticamente.
      </p>
    </CycleActionSection>
  );
}

function ScheduleInput({
  label,
  value,
  onChange,
  hint,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className={formSurface.fieldGroup}>
      <span className={formSurface.label}>{label}</span>
      <input
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={formSurface.input}
        disabled={disabled}
      />
      {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

function CompletedCycleActions({
  controller,
  cycleId,
  organizationId,
  reportLifecycleStatus,
}: {
  controller: ReturnType<typeof useCycleActionsController>;
  cycleId: string;
  organizationId: string;
  reportLifecycleStatus: ReportLifecycleStatus | null;
}) {
  const { state, patch, busy, otherBoundaryTargets } = controller;
  const reopenTarget = otherBoundaryTargets.find((target) => target.effect === "reopen");
  const reportAvailable = reportLifecycleStatus === "available";
  const reportMessage =
    reportLifecycleStatus === "emission_failed"
      ? "A emissão automática falhou. Refaça a emissão em Relatórios antes de reabrir o diagnóstico."
      : reportLifecycleStatus === "emitting"
        ? "O relatório oficial ainda está sendo emitido. A reabertura será liberada depois que o PDF estiver preservado."
        : reportLifecycleStatus === "ready_to_emit"
          ? "O relatório oficial ainda precisa ser emitido. Conclua a emissão antes de reabrir o diagnóstico."
          : !reportAvailable
            ? "O relatório oficial deste encerramento ainda não está disponível."
            : null;

  return (
    <CycleActionSection
      title="Reabertura do diagnóstico"
      description="Cria uma nova versão de processamento e preserva o resultado e o relatório oficial anteriores no histórico."
      error={state.error}
      action={reopenTarget ? (
        <LoadingButton
          type="button"
          pending={state.transitioningTo === reopenTarget.to}
          pendingLabel={`${reopenTarget.label}…`}
          disabled={busy || !reportAvailable}
          onClick={() => void controller.runTransition(reopenTarget.to, reopenTarget.label, reopenTarget.effect)}
          className={formSurface.secondaryButtonSm}
        >
          {reopenTarget.label}
        </LoadingButton>
      ) : null}
    >
      {reportMessage ? (
        <p className="text-sm leading-relaxed text-amber-800">
          {reportMessage}{" "}
          <Link
            href={`/admin/relatorios?organizationId=${encodeURIComponent(organizationId)}&cycleId=${encodeURIComponent(cycleId)}`}
            className="font-semibold underline underline-offset-2"
          >
            Abrir Relatórios
          </Link>
        </p>
      ) : null}
      <label className={formSurface.fieldGroup}>
        <span className={formSurface.label}>Justificativa da reabertura</span>
        <textarea
          value={state.reopenReason}
          onChange={(event) => patch({ reopenReason: event.target.value })}
          className={formSurface.inputTextarea}
          rows={3}
          maxLength={2000}
          placeholder="Explique o motivo institucional da reabertura e o que deverá ser corrigido."
          disabled={!reportAvailable}
        />
      </label>
      <ScheduleInput
        label="Novo prazo de resposta"
        value={state.reopenDeadlineAt}
        onChange={(reopenDeadlineAt) => patch({ reopenDeadlineAt })}
        disabled={!reportAvailable}
      />
    </CycleActionSection>
  );
}

function TransitionButtons({ controller }: { controller: ReturnType<typeof useCycleActionsController> }) {
  const { state, busy, otherBoundaryTargets, intermediateTargets } = controller;
  return (
    <>
      {otherBoundaryTargets.map(({ to, effect, label }) => (
        <LoadingButton
          key={to}
          type="button"
          pending={state.transitioningTo === to}
          pendingLabel={`${label}…`}
          disabled={busy}
          onClick={() => void controller.runTransition(to, label, effect)}
          className={formSurface.secondaryButtonSm}
        >
          {label}
        </LoadingButton>
      ))}
      {intermediateTargets.map(({ to, label }) => (
        <LoadingButton
          key={to}
          type="button"
          pending={state.transitioningTo === to}
          pendingLabel={`${label}…`}
          disabled={busy}
          onClick={() => void controller.runTransition(to, label)}
          className={formSurface.secondaryButtonSm}
        >
          {label}
        </LoadingButton>
      ))}
    </>
  );
}
