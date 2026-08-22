import { requireRole } from "@/infrastructure/auth/current-user";
import { SupportPageContent } from "@/features/support/components/support-page-content";

export default async function RespondenteSuportePage() {
  await requireRole(["respondent"]);
  return <SupportPageContent role="respondent" />;
}
