import { requireRole } from "@/infrastructure/auth/current-user";
import { ProfilePageContent } from "@/features/profile/components/profile-page-content";

export default async function RespondentePerfilPage() {
  const user = await requireRole(["respondent"]);
  return <ProfilePageContent user={user} />;
}
