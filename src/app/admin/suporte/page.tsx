import { requireRole } from "@/infrastructure/auth/current-user";
import { SupportPageContent } from "@/features/support/components/support-page-content";

export default async function AdminSuportePage() {
  await requireRole(["admin"]);
  return <SupportPageContent role="admin" />;
}
