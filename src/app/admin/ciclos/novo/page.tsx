import Link from "next/link";
import { RotateCw, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/shared/ui/components/page-header";
import { CreateCycleForm } from "@/features/cycles/components/CreateCycleForm";
import { requireRole } from "@/infrastructure/auth/current-user";
import { listAllOrganizationOptions } from "@/features/organizations/admin-service";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import {
  listFormAssignmentFilterOptions,
  listFormFilterOptions,
} from "@/features/admin/filter-catalog";
import { firstSearchParam } from "@/features/admin/search-params";
import { layout } from "@/shared/layout/design-system";
import { formSurface } from "@/shared/layout/form-surface";

export default async function AdminNovoCicloPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["admin"]);
  const supabase = createSupabaseServiceRoleClient();
  const sp = await searchParams;
  const requestedFormId = firstSearchParam(sp, "formId");
  const publishedNow = firstSearchParam(sp, "published") === "1";

  const [publishedForms, organizations] = await Promise.all([
    listFormFilterOptions(supabase, { publishedOnly: true }),
    listAllOrganizationOptions(),
  ]);

  const formIds = publishedForms.map((form) => form.id);
  const assignments = await listFormAssignmentFilterOptions(supabase, formIds);

  const assignedByForm = new Map<string, string[]>();
  for (const assignment of assignments) {
    const existing = assignedByForm.get(assignment.formId) ?? [];
    existing.push(assignment.organizationId);
    assignedByForm.set(assignment.formId, existing);
  }

  const formOptions = publishedForms.map((form) => ({
    id: form.id,
    label: form.name,
    organizationIds: assignedByForm.get(form.id) ?? [],
  }));
  const orgOptions = organizations.map((organization) => ({
    id: organization.id,
    label: organization.acronym ? `${organization.acronym} — ${organization.name}` : organization.name,
  }));

  return (
    <div className={`mx-auto max-w-5xl ${layout.panelStack}`}>
      <Link
        href={requestedFormId ? `/admin/ciclos?formId=${encodeURIComponent(requestedFormId)}` : "/admin/ciclos"}
        className="inline-flex items-center gap-1 text-sm text-sky-700 hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Voltar ao painel de diagnósticos
      </Link>
      <PageHeader
        title="Novo diagnóstico"
        description="Crie diagnósticos para todas as organizações vinculadas ou para uma seleção específica, com abertura imediata, agendada ou em rascunho."
        icon={RotateCw}
      />
      <div className={formSurface.card}>
        <div className="px-5 py-5 sm:px-6">
          {formOptions.length === 0 ? (
            <p className="text-sm text-slate-600">
              Nenhum formulário publicado está disponível. <Link href="/admin/formularios" className="text-sky-700 hover:underline">Publique um formulário</Link> antes de criar um diagnóstico.
            </p>
          ) : orgOptions.length === 0 ? (
            <p className="text-sm text-slate-600">
              Nenhuma organização cadastrada. <Link href="/admin/organizacoes" className="text-sky-700 hover:underline">Cadastre uma organização</Link> primeiro.
            </p>
          ) : (
            <CreateCycleForm forms={formOptions} organizations={orgOptions}
              initialFormId={requestedFormId ?? undefined} publishedNow={publishedNow} />
          )}
        </div>
      </div>
    </div>
  );
}
