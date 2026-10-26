import { respondentAppointmentLabels } from "@/features/admin";
import {
  groupOrganizationAccess,
  organizationAccessDisplayName,
  type OrganizationAccessMember,
} from "@/features/profile/organization-access";
import { typography } from "@/shared/layout/design-system";
import { formSurface } from "@/shared/layout/form-surface";
import { PanelSection } from "@/shared/ui/components/panel-section";

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${first}${last}`.toLocaleUpperCase("pt-BR");
}

function MemberCard({
  member,
  currentUserId,
}: {
  member: OrganizationAccessMember;
  currentUserId: string;
}) {
  const name = organizationAccessDisplayName(member);
  const isCurrent = member.userId === currentUserId;

  return (
    <li
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
        isCurrent ? "border-brand-200 bg-brand-50" : "border-slate-200 bg-white"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          isCurrent ? "bg-brand-100 text-brand-800" : "bg-slate-100 text-slate-600"
        }`}
        aria-hidden
      >
        {initials(name)}
      </span>
      <p className="min-w-0 text-sm font-medium text-slate-900">
        <span className="block truncate">{name}</span>
        {isCurrent ? <span className="text-xs font-medium text-brand-800">Você</span> : null}
      </p>
    </li>
  );
}

function AccessColumn({
  title,
  members,
  currentUserId,
}: {
  title: string;
  members: OrganizationAccessMember[];
  currentUserId: string;
}) {
  return (
    <section className="min-w-0 px-1 pt-4 sm:px-3" aria-label={title}>
      <h3 className="mb-3 text-center text-sm font-semibold text-slate-800">{title}</h3>
      <ul className="space-y-2">
        {members.map((member) => (
          <MemberCard key={member.userId} member={member} currentUserId={currentUserId} />
        ))}
      </ul>
    </section>
  );
}

export function OrganizationAccessChart({
  organizationName,
  currentUserId,
  members,
}: {
  organizationName: string;
  currentUserId: string;
  members: OrganizationAccessMember[];
}) {
  const groups = groupOrganizationAccess(members);
  const columns = [
    groups.titulares.length > 0
      ? { title: respondentAppointmentLabels.titular, members: groups.titulares }
      : null,
    groups.suplentes.length > 0
      ? { title: respondentAppointmentLabels.suplente, members: groups.suplentes }
      : null,
  ].filter((column) => column !== null);
  const split = columns.length > 1;

  return (
    <PanelSection
      title="Acesso do órgão"
      description="Quem está cadastrado como titular ou suplente."
      variant="plain"
    >
      <div className={`${formSurface.dashboardPanel} ${formSurface.dashboardPanelPadding}`}>
        <div className="flex flex-col items-center">
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center shadow-sm">
            <p className={`${typography.contextLabel} uppercase tracking-wide`}>Organização</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-950">{organizationName}</p>
          </div>

          {columns.length === 0 ? (
            <p className="mt-5 text-center text-sm text-slate-500">
              Nenhum titular ou suplente cadastrado neste órgão.
            </p>
          ) : (
            <>
              <div className="h-4 w-px bg-slate-200" aria-hidden />
              {split ? (
                <div className="hidden w-full grid-cols-2 sm:grid" aria-hidden>
                  <div className="h-4 border-b border-r border-slate-200" />
                  <div className="h-4 border-b border-slate-200" />
                </div>
              ) : null}
              <div
                className={
                  split
                    ? "grid w-full grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-0"
                    : "w-full max-w-sm"
                }
              >
                {columns.map((column) => (
                  <AccessColumn
                    key={column.title}
                    title={column.title}
                    members={column.members}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </PanelSection>
  );
}
