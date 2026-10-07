import { Suspense } from "react";
import { notFound } from "next/navigation";
import { firstSearchParam } from "@/features/admin/search-params";
import { listCycles } from "@/features/cycles/cycle-queries";
import { isCollectionFullySuspended } from "@/features/cycles/form-management/domain";
import { FormsAdminService, FormsNotFoundError } from "@/features/forms/admin-service";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { FormWizard } from "@/features/forms/components/form/form-wizard/form-wizard";
import { PublishedFormConfig } from "@/features/forms/components/form/published-form-config";
import { Spinner } from "@/shared/ui/components/loading";
import { parseUuidParam } from "@/shared/validation/uuid";

type Props = {
  params: Promise<{ formId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminFormularioConfiguracaoPage({
  params,
  searchParams,
}: Props) {
  const { formId: rawId } = await params;
  const formId = parseUuidParam(rawId);
  if (!formId) notFound();

  let form;
  try {
    form = await new FormsAdminService().getById(formId);
  } catch (error) {
    if (error instanceof FormsNotFoundError) notFound();
    throw error;
  }

  const sp = await searchParams;
  const editingPublished = firstSearchParam(sp, "editar") === "1";
  const showWizard = form.state === "draft" || editingPublished;

  if (!showWizard) {
    const cycles = await listCycles(createSupabaseServiceRoleClient(), { formId: form.id });
    const canWithdraw =
      form.state === "published" &&
      isCollectionFullySuspended(
        cycles.map((cycle) => ({
          state: cycle.state,
          responseCollectionPausedAt: cycle.responseCollectionPausedAt,
        })),
      );
    return (
      <PublishedFormConfig
        formId={form.id}
        formName={form.name}
        canWithdraw={canWithdraw}
      />
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Spinner size="xl" className="text-brand" />
        </div>
      }
    >
      <FormWizard
        formId={form.id}
        initialFormName={form.name}
        nameEditable={form.state === "draft"}
      />
    </Suspense>
  );
}
