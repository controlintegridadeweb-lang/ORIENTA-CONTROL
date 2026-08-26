import Link from "next/link";
import { CsvImportPanel } from "@/features/imports/components/CsvImportPanel";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { requireRole } from "@/infrastructure/auth/current-user";
import { AdminUsuariosHero } from "@/features/admin/components/admin-usuarios-hero";
import { listUsersForAdmin } from "@/features/admin/users-service";
import { getOrganizationOptions } from "@/features/organizations/options";
import { firstSearchParam } from "@/features/admin/search-params";
import { ADMIN_PAGE_HERO_BLEED } from "@/shared/layout/admin-page-layout";
import { layout, typography } from "@/shared/layout/design-system";
import { formSurface } from "@/shared/layout/form-surface";
import { countLabel } from "@/shared/format/count-label";
import { EditableUserRow, ReadonlyAdminRow, UserRowGridHeader } from "./user-row";
import { CreateRespondentForm } from "./create-respondent-form";

const PAGE_SIZE = 25;

function pageHref(input: { organizationId: string; query: string; page: number }): string {
  const params = new URLSearchParams();
  if (input.organizationId) params.set("organizationId", input.organizationId);
  if (input.query) params.set("q", input.query);
  if (input.page > 1) params.set("page", String(input.page));
  const query = params.toString();
  return query ? `/admin/usuarios?${query}` : "/admin/usuarios";
}

export default async function AdminUsuariosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const organizationId = firstSearchParam(sp, "organizationId") ?? "";
  const query = (firstSearchParam(sp, "q") ?? "").trim();
  const rawPage = Number(firstSearchParam(sp, "page") ?? "1");
  const requestedPage = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const organizations = await getOrganizationOptions();
  const requestedOffset = (requestedPage - 1) * PAGE_SIZE;
  let usersPage = await listUsersForAdmin({
    search: query || undefined,
    organizationId: organizationId || undefined,
    limit: PAGE_SIZE,
    offset: requestedOffset,
  });
  const totalPages = Math.max(1, Math.ceil(usersPage.total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  if (page !== requestedPage) {
    usersPage = await listUsersForAdmin({
      search: query || undefined,
      organizationId: organizationId || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
  }
  const visibleUsers = usersPage.items;
  const orgNameById = new Map(organizations.map((organization) => [organization.id, organization.name]));

  return (
    <div className={layout.pageStack}>
      <div className={ADMIN_PAGE_HERO_BLEED}>
        <AdminUsuariosHero />
      </div>

      <div className={`${layout.panelStack} pt-1`}>
        {organizations.length === 0 ? (
          <div className={formSurface.messageWarning}>
            Nenhuma organização cadastrada — não é possível criar respondentes ainda.{" "}
            <Link href="/admin/organizacoes" className="font-semibold underline">
              Cadastre uma organização
            </Link>{" "}
            primeiro.
          </div>
        ) : null}

        <PanelSection
          title="Criar respondente"
          description="Cria a conta de acesso, vincula à organização escolhida e somente depois envia as instruções de primeiro acesso."
          variant="card"
        >
          <CreateRespondentForm organizations={organizations} />
        </PanelSection>

        <CsvImportPanel kind="respondents" />

        <PanelSection
          title="Cadastro de usuários"
          description="Administradores aparecem somente para consulta. Edição (nome, e-mail, organização) e remoção são restritas a respondentes."
          variant="card"
        >
          <div className="space-y-5">
            <form
              method="get"
              className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_auto] lg:items-end"
            >
            <label className={`${formSurface.fieldGroup} min-w-0 sm:col-span-2 lg:col-span-1`}>
              <span className={formSurface.label}>Buscar</span>
              <input
                name="q"
                defaultValue={query}
                placeholder="Nome, e-mail ou organização"
                className={formSurface.input}
              />
            </label>
            <label className={`${formSurface.fieldGroup} min-w-0`}>
              <span className={formSurface.label}>Organização</span>
              <select
                name="organizationId"
                defaultValue={organizationId}
                className={formSurface.inputSelect}
              >
                <option value="">Todas</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex w-full flex-col gap-2 sm:col-span-2 sm:flex-row lg:col-span-1 lg:w-auto">
              <button type="submit" className={`${formSurface.primaryButtonSm} w-full sm:w-auto`}>
                Aplicar
              </button>
              {query || organizationId ? (
                <Link
                  href="/admin/usuarios"
                  className={`${formSurface.secondaryButtonSm} w-full sm:w-auto`}
                >
                  Limpar
                </Link>
              ) : null}
            </div>
          </form>

          <p className={typography.auxiliary}>
            {countLabel(usersPage.total, "usuário encontrado", "usuários encontrados")}
          </p>

          {visibleUsers.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-500">
              Nenhum usuário coincide com os filtros.
            </p>
          ) : (
            <div className={formSurface.brandTable.wrapper}>
              <UserRowGridHeader />
              {visibleUsers.map((user, index) =>
                user.role === "admin" ? (
                  <ReadonlyAdminRow
                    key={user.userId}
                    user={user}
                    zebraEven={index % 2 === 0}
                    orgName={
                      user.organizationId
                        ? (orgNameById.get(user.organizationId) ?? null)
                        : null
                    }
                  />
                ) : (
                  <EditableUserRow
                    key={user.userId}
                    user={user}
                    zebraEven={index % 2 === 0}
                    organizations={organizations}
                  />
                ),
              )}
            </div>
          )}

          {totalPages > 1 ? (
            <nav
              className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"
              aria-label="Paginação de usuários"
            >
              <span className={typography.meta}>
                Página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                {page === 1 ? (
                  <span
                    aria-disabled="true"
                    className={`${formSurface.secondaryButtonSm} cursor-not-allowed opacity-50`}
                  >
                    Anterior
                  </span>
                ) : (
                  <Link
                    href={pageHref({ organizationId, query, page: page - 1 })}
                    className={formSurface.secondaryButtonSm}
                  >
                    Anterior
                  </Link>
                )}
                {page === totalPages ? (
                  <span
                    aria-disabled="true"
                    className={`${formSurface.secondaryButtonSm} cursor-not-allowed opacity-50`}
                  >
                    Próxima
                  </span>
                ) : (
                  <Link
                    href={pageHref({ organizationId, query, page: page + 1 })}
                    className={formSurface.secondaryButtonSm}
                  >
                    Próxima
                  </Link>
                )}
              </div>
            </nav>
          ) : null}
          </div>
        </PanelSection>
      </div>
    </div>
  );
}
