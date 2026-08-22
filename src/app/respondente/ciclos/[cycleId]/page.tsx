import { notFound } from "next/navigation";
import { firstSearchParam } from "@/features/admin/search-params";
import { getCycleDetail } from "@/features/cycles/cycle-queries";
import { FormFillWorkspace } from "@/features/forms/components/form/form-fill-workspace";
import { WorkbenchShell } from "@/features/workbench/components/workbench-shell";
import { getCurrentUser } from "@/infrastructure/auth/current-user";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { isRespondentCollectionEditable } from "@/shared/domain/workflow";
import {
  respondentCycleReturnLabel,
  respondentCycleReturnPathOrFallback,
} from "@/shared/navigation/respondent-navigation-context";
import { parseUuidParam } from "@/shared/validation/uuid";

type Props = {
  params: Promise<{ cycleId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readOnlyMessage(input: {
  state: string;
  responseCollectionPausedAt: string | null;
}): string | undefined {
  if (input.responseCollectionPausedAt) {
    return "A coleta deste diagnóstico está suspensa administrativamente.";
  }
  if (input.state === "submitted") {
    return "O diagnóstico foi enviado e aguarda o início da validação.";
  }
  if (input.state === "in_validation") {
    return "A administração está analisando as respostas e evidências.";
  }
  if (input.state === "validated") {
    return "A validação foi concluída. Consulte o Resultado FAMI e as recomendações.";
  }
  if (input.state === "completed") {
    return "A avaliação foi encerrada. O conteúdo permanece disponível para consulta.";
  }
  return undefined;
}

export default async function RespondenteCicloPage({ params, searchParams }: Props) {
  const user = await getCurrentUser();
  const { cycleId: rawId } = await params;
  const cycleId = parseUuidParam(rawId);
  if (!cycleId || !user?.organizationId) notFound();

  const cycle = await getCycleDetail(createSupabaseServiceRoleClient(), cycleId);
  if (!cycle || cycle.organizationId !== user.organizationId || cycle.state === "draft") {
    notFound();
  }

  const sp = await searchParams;
  const returnTo = respondentCycleReturnPathOrFallback(firstSearchParam(sp, "returnTo"));
  const questionId = parseUuidParam(firstSearchParam(sp, "questionId"));
  const editable = isRespondentCollectionEditable(
    cycle.state,
    cycle.responseCollectionPausedAt,
  );

  return (
    <FormFillWorkspace
      backHref={returnTo}
      backLabel={respondentCycleReturnLabel(returnTo)}
      title={cycle.formName}
      subtitle={cycle.periodLabel}
    >
      <WorkbenchShell
        mode="respondent"
        initialCycleId={cycle.id}
        autoLoad
        initialFocusQuestionId={questionId}
        readOnly={!editable}
        readOnlyMessage={readOnlyMessage(cycle)}
        submissionReturnTo={returnTo}
      />
    </FormFillWorkspace>
  );
}
