import { formatPlatformDate } from "@/shared/datetime/platform-date-time";
import Link from "next/link";
import { CsvImportPanel } from "@/features/imports/components/CsvImportPanel";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { requireRole } from "@/infrastructure/auth/current-user";
import { listOrganizationsDetailed } from "@/features/organizations/admin-service";
import { AdminOrganizacoesHero } from "@/features/organizations/components/admin-organizacoes-hero";
import { ADMIN_PAGE_HERO_BLEED } from "@/shared/layout/admin-page-layout";
import { layout, typography } from "@/shared/layout/design-system";
import { formSurface } from "@/shared/layout/form-surface";
import { countLabel } from "@/shared/format/count-label";
import { firstSearchParam } from "@/features/admin/search-params";
import { CreateOrganizationForm } from "./create-organization-form";

const PAGE_SIZE = 25;

function pageHref(page: number, search: string) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/organizacoes?${query}` : "/admin/organizacoes";
}

export default async function AdminOrganizacoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const search = firstSearchParam(sp, "search")?.trim() ?? "";
  const requestedPage = Number(firstSearchParam(sp, "page") ?? "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const organizations = await listOrganizationsDetailed({
    search,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(organizations.total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  return (
    <div className={layout.pageStack}>
      <div className={ADMIN_PAGE_HERO_BLEED}>
        <AdminOrganizacoesHero />
      </div>

      <div className={`${layout.panelStack} pt-1`}>
        <PanelSection
          title="Cadastrar organização"
          description="O nome e a sigla são únicos. Após cadastrar, vincule respondentes pela tela de Usuários."
          variant="card"
        >
          <CreateOrganizationForm />
        </PanelSection>

        <CsvImportPanel kind="organizations" />

        <PanelSection
          title="Organizações cadastradas"
          description={`${countLabel(organizations.total, "organização", "organizações")} no total.`}
          variant="card"
        >
          <div className="space-y-5">
          <form className="flex flex-col gap-2 sm:flex-row sm:items-end" action="/admin/organizacoes">
            <label className={`min-w-0 flex-1 ${formSurface.fieldGroup}`}>
              <span className={formSurface.label}>Buscar organização</span>
              <input
                name="search"
                defaultValue={search}
                className={formSurface.input}
                placeholder="Nome ou sigla"
              />
            </label>
            <button type="submit" className={formSurface.secondaryButton}>
              Buscar
            </button>
          </form>
          {organizations.items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-500">
              {search
                ? "Nenhuma organização corresponde à busca."
                : "Nenhuma organização cadastrada ainda."}
            </p>
          ) : (
            <div className={formSurface.brandTable.wrapper}>
              <table className={formSurface.brandTable.table}>
                <thead className={formSurface.brandTable.head}>
                  <tr>
                    <th className={formSurface.brandTable.headCell}>Sigla</th>
                    <th className={formSurface.brandTable.headCell}>Organização</th>
                    <th className={formSurface.brandTable.headCell}>Usuários</th>
                    <th className={formSurface.brandTable.headCell}>Respondentes</th>
                    <th className={formSurface.brandTable.headCell}>Criada em</th>
                  </tr>
                </thead>
                <tbody>
                  {organizations.items.map((org, index) => (
                    <tr
                      key={org.id}
                      className={index % 2 === 0 ? formSurface.brandTable.rowEven : formSurface.brandTable.rowOdd}
                    >
                      <td
                        className={`${formSurface.brandTable.cellMuted} font-mono text-xs font-semibold`}
                      >
                        {org.acronym || "—"}
                      </td>
                      <td className={`${formSurface.brandTable.cell} font-semibold text-slate-900`}>
                        {org.name}
                      </td>
                      <td className={formSurface.brandTable.cell}>
                        <Link
                          href={`/admin/usuarios?organizationId=${encodeURIComponent(org.id)}`}
                          className="font-semibold text-sky-700 hover:underline"
                        >
                          {org.userCount}
                        </Link>
                      </td>
                      <td className={formSurface.brandTable.cell}>
                        <Link
                          href={`/admin/usuarios?organizationId=${encodeURIComponent(org.id)}`}
                          className="font-semibold text-sky-700 hover:underline"
                        >
                          {org.respondentCount}
                        </Link>
                      </td>
                      <td className={`${formSurface.brandTable.cell} whitespace-nowrap`}>
                        {org.createdAt
                          ? formatPlatformDate(org.createdAt, { dateStyle: "short" })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 ? (
            <nav
              aria-label="Paginação de organizações"
              className="flex items-center justify-between gap-3"
            >
              <span className={typography.meta}>
                Página {safePage} de {totalPages}
              </span>
              <div className="flex gap-2">
                {safePage > 1 ? (
                  <Link
                    className={formSurface.secondaryButtonSm}
                    href={pageHref(safePage - 1, search)}
                  >
                    Anterior
                  </Link>
                ) : (
                  <span className={`${formSurface.secondaryButtonSm} opacity-50`}>Anterior</span>
                )}
                {safePage < totalPages ? (
                  <Link
                    className={formSurface.secondaryButtonSm}
                    href={pageHref(safePage + 1, search)}
                  >
                    Próxima
                  </Link>
                ) : (
                  <span className={`${formSurface.secondaryButtonSm} opacity-50`}>Próxima</span>
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
