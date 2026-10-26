import type { RespondentAppointment } from "@/features/admin";

export type OrganizationAccessMember = {
  userId: string;
  fullName: string | null;
  email: string | null;
  appointment: RespondentAppointment | null;
};

export type OrganizationAccessGroups = {
  titulares: OrganizationAccessMember[];
  suplentes: OrganizationAccessMember[];
  unassigned: OrganizationAccessMember[];
};

function byDisplayName(left: OrganizationAccessMember, right: OrganizationAccessMember): number {
  const leftName = (left.fullName?.trim() || left.email || "").toLocaleLowerCase("pt-BR");
  const rightName = (right.fullName?.trim() || right.email || "").toLocaleLowerCase("pt-BR");
  return leftName.localeCompare(rightName, "pt-BR") || left.userId.localeCompare(right.userId);
}

/** Separa as pessoas do órgão em titular, suplente e cargo ainda não informado. */
export function groupOrganizationAccess(
  members: OrganizationAccessMember[],
): OrganizationAccessGroups {
  const titulares: OrganizationAccessMember[] = [];
  const suplentes: OrganizationAccessMember[] = [];
  const unassigned: OrganizationAccessMember[] = [];

  for (const member of members) {
    if (member.appointment === "titular") titulares.push(member);
    else if (member.appointment === "suplente") suplentes.push(member);
    else unassigned.push(member);
  }

  titulares.sort(byDisplayName);
  suplentes.sort(byDisplayName);
  unassigned.sort(byDisplayName);
  return { titulares, suplentes, unassigned };
}

export function organizationAccessDisplayName(member: OrganizationAccessMember): string {
  const name = member.fullName?.trim();
  if (name) return name;
  const email = member.email?.trim();
  if (email) return email;
  return "Nome não informado";
}
