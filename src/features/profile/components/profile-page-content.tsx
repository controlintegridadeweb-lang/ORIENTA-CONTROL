import { ProfileEditForm } from "@/features/profile/components/profile-edit-form";
import { ProfileShell } from "@/features/profile/components/profile-shell";
import type { CurrentUser } from "@/infrastructure/auth/current-user";
import { roleLabels } from "@/shared/ui/navigation";

const PROFILE_DESCRIPTION =
  "Atualize seus dados pessoais, consulte os acessos da conta e altere sua senha de acesso.";

export function ProfilePageContent({ user }: { user: CurrentUser }) {
  return (
    <ProfileShell
      title="Meu Perfil"
      description={PROFILE_DESCRIPTION}
      roleLabel={roleLabels[user.role]}
      variant={user.role === "admin" ? "admin" : "respondent"}
    >
      <ProfileEditForm user={user} />
    </ProfileShell>
  );
}
