import { OrganizationAccessChart } from "@/features/profile/components/organization-access-chart";
import { ProfileEditForm } from "@/features/profile/components/profile-edit-form";
import { ProfileShell } from "@/features/profile/components/profile-shell";
import { loadOrganizationAccess } from "@/features/profile/load-organization-access";
import type { CurrentUser } from "@/infrastructure/auth/current-user";
import { roleLabels } from "@/shared/ui/navigation";

const ADMIN_PROFILE_DESCRIPTION =
  "Atualize seus dados pessoais, consulte os acessos da conta e altere sua senha de acesso.";

const RESPONDENT_PROFILE_DESCRIPTION =
  "Atualize seus dados pessoais, veja quem está cadastrado no órgão e altere sua senha de acesso.";

export async function ProfilePageContent({ user }: { user: CurrentUser }) {
  const organizationId = user.role === "respondent" ? user.organizationId : null;
  const members = organizationId ? await loadOrganizationAccess(organizationId) : null;

  return (
    <ProfileShell
      title="Meu Perfil"
      description={organizationId ? RESPONDENT_PROFILE_DESCRIPTION : ADMIN_PROFILE_DESCRIPTION}
      roleLabel={roleLabels[user.role]}
      variant={user.role === "admin" ? "admin" : "respondent"}
    >
      <ProfileEditForm
        user={user}
        accessSection={
          members ? (
            <OrganizationAccessChart
              organizationName={user.organizationName ?? "Sua organização"}
              currentUserId={user.userId}
              members={members}
            />
          ) : null
        }
      />
    </ProfileShell>
  );
}
