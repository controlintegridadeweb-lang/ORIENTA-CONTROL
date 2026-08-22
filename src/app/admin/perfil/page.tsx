import { requireRole } from "@/infrastructure/auth/current-user";
import { ProfilePageContent } from "@/features/profile/components/profile-page-content";

export default async function AdminPerfilPage() {
  const user = await requireRole(["admin"]);
  return <ProfilePageContent user={user} />;
}
