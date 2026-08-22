"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Spinner } from "@/shared/ui/components/loading";
import {
  fetchFormPublishReadiness,
  listFormQuestions,
  type FormPublishReadinessPayload,
} from "@/features/forms/client";
import type { FormPublishReadiness } from "@/features/forms/publish-readiness";
import { FormManagementSection } from "@/features/forms/components/form/form-tab-panel";
import { formManagementUi } from "@/features/forms/components/form/form-management-ui";
import { formSurface } from "@/shared/layout/form-surface";

type Props = {
  formId: string;
  formName: string;
  onReadinessChange?: (readiness: FormPublishReadiness) => void;
};

const CHECK_LABELS: Record<keyof FormPublishReadiness["checks"], string> = {
  hasName: "Nome do formulário",
  hasQuestions: "Pelo menos uma pergunta cadastrada",
  bindingsComplete: "Configurações e recomendação-base por pergunta",
  hasAssignments: "Pelo menos uma organização incluída",
};

/** Etapa 5 — resumo e pendências antes da publicação. */
export function FormWizardReviewStep({ formId, formName, onReadinessChange }: Props) {
  const [payload, setPayload] = useState<FormPublishReadinessPayload | null>(null);
  const [questionPrompts, setQuestionPrompts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchFormPublishReadiness(formId), listFormQuestions(formId)])
      .then(([readinessPayload, questions]) => {
        if (cancelled) return;
        setPayload(readinessPayload);
        setQuestionPrompts(questions.map((q) => q.prompt));
        onReadinessChange?.(readinessPayload.readiness);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Falha ao carregar resumo.");
      });
    return () => {
      cancelled = true;
    };
  }, [formId, onReadinessChange]);

  if (error) {
    return <div role="alert" aria-live="assertive" className={formSurface.messageError}>{error}</div>;
  }

  if (!payload) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-slate-600">
        <Spinner size="md" />
        Montando resumo…
      </div>
    );
  }

  const { readiness } = payload;
  const pendingCount = readiness.pending.length;

  return (
    <FormManagementSection
      title="Revisão e publicação"
      description="Confira o resumo antes de publicar. O formulário permanece em rascunho se você apenas salvar e sair."
    >
      <div className={formManagementUi.surface}>
        <div className="space-y-3 p-4">
          <h4 className={formManagementUi.subsectionTitle}>Resumo</h4>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Nome</dt>
              <dd className="font-medium text-slate-900">{formName}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Perguntas</dt>
              <dd className="font-medium text-slate-900">{readiness.questionCount}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Organizações</dt>
              <dd className="font-medium text-slate-900">{readiness.assignmentCount}</dd>
            </div>
          </dl>
          {questionPrompts.length > 0 ? (
            <ul className="list-inside list-decimal text-sm text-slate-700">
              {questionPrompts.slice(0, 8).map((p, index) => (
                <li key={`${index}:${p}`} className="truncate">
                  {p}
                </li>
              ))}
              {questionPrompts.length > 8 ? (
                <li className="text-slate-500">+ {questionPrompts.length - 8} pergunta(s)</li>
              ) : null}
            </ul>
          ) : null}
        </div>

        <div className="space-y-2 border-t border-slate-200 p-4">
          <h4 className={formManagementUi.subsectionTitle}>Checklist de publicação</h4>
          <ul className="space-y-2">
            {(Object.keys(CHECK_LABELS) as Array<keyof FormPublishReadiness["checks"]>).map((key) => {
              const ok = readiness.checks[key];
              const blocked = !ok;
              return (
                <li key={key} className="flex items-start gap-2 text-sm">
                  {ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                  ) : (
                    <AlertCircle
                      className={`mt-0.5 h-4 w-4 shrink-0 ${blocked ? "text-amber-600" : "text-slate-400"}`}
                      aria-hidden
                    />
                  )}
                  <span className={blocked ? "font-medium text-amber-900" : "text-slate-700"}>
                    {CHECK_LABELS[key]}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {pendingCount > 0 ? (
          <div className="border-t border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">
              {pendingCount} pergunta(s) com configuração pendente. Volte à etapa Perguntas e configurações para concluir.
            </p>
          </div>
        ) : readiness.canPublish ? (
          <p className="border-t border-slate-200 px-4 py-3 text-sm text-brand-800">
            Tudo pronto para publicar. Após publicar, crie e abra um diagnóstico para a
            organização e o período desejados. Somente diagnósticos abertos ficam disponíveis para resposta.
          </p>
        ) : null}
      </div>
    </FormManagementSection>
  );
}
