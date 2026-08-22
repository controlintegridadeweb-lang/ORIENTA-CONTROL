import Link from "next/link";
import { AuthGlassCard } from "@/features/auth/components/auth-glass-card";
import { AuthSplitLayout } from "@/features/auth/components/auth-split-layout";
import { RequestResetForm } from "@/features/auth/components/request-reset-form";
import { typography } from "@/shared/layout/design-system";

export default function ForgotPasswordPage() {
  return (
    <AuthSplitLayout>
      <AuthGlassCard>
        <header className="mb-10 space-y-2">
          <p className={typography.panelEyebrow}>Plataforma Orienta</p>
          <h1 className={`text-balance ${typography.pageTitle}`}>Recuperar senha</h1>
          <p className={typography.pageDescription}>
            Informe seu e-mail cadastrado. Você receberá um link para criar uma nova senha.
          </p>
        </header>
        <RequestResetForm />
        <p className={`mt-10 text-center ${typography.auxiliary}`}>
          <Link
            href="/"
            className="font-medium text-brand-800 underline decoration-brand-800/30 underline-offset-1 transition hover:text-brand-900 hover:decoration-brand-900/50 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
          >
            Voltar para o login
          </Link>
        </p>
      </AuthGlassCard>
    </AuthSplitLayout>
  );
}
