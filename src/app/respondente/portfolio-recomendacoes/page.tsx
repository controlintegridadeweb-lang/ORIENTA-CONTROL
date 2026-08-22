import { getCurrentUser } from "@/infrastructure/auth/current-user";
import { RespondentRecommendationsShell } from "@/features/improvement-management/recommendations/components/respondent/respondent-recommendations-shell";
import { formSurface } from "@/shared/layout/form-surface";
import { layout } from "@/shared/layout/design-system";

/**
 * Portfolio de Recomendacoes do Respondente.
 *
 * Server thin: garante que o usuario tem `organizationId` e delega para o
 * shell client-side. A listagem reusa `/api/respondent/action-plans?view=overview`,
 * que ja entrega `plan` (quando existe) por recomendacao.
 */
export default async function RespondentePortfolioRecomendacoesPage() {
  const user = await getCurrentUser();
  const organizationId = user?.organizationId ?? "";

  if (!organizationId) {
    return (
      <div className={formSurface.messageWarning}>
        Sua conta não está vinculada a uma organização. Entre em contato com o administrador.
      </div>
    );
  }

  return (
    <div className={layout.pageStack}>
      <RespondentRecommendationsShell />
    </div>
  );
}
