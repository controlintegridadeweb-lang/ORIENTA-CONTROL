import Link from "next/link";
import { AuthGlassCard } from "@/features/auth/components/auth-glass-card";
import { AuthSplitLayout } from "@/features/auth/components/auth-split-layout";
import { UpdatePasswordForm } from "@/features/auth/components/update-password-form";
import { typography } from "@/shared/layout/design-system";

// Página de callback de recuperação de senha: lê o `code` da URL em runtime e
// troca por sessão no Supabase. Não faz sentido como asset estático — força
// renderização sob demanda (evita prerender no build e seus efeitos colaterais).
export const dynamic = "force-dynamic";

export default function UpdatePasswordPage() {
  return (
    <AuthSplitLayout>
      <AuthGlassCard>
        <header className="mb-10 space-y-2">
          <p className={typography.panelEyebrow}>Plataforma Orienta</p>
          <h1 className={`text-balance ${typography.pageTitle}`}>Nova senha</h1>
          <p className={typography.pageDescription}>
            Defina uma senha forte e guarde em local seguro. Em seguida, volte ao login para entrar com o novo
            acesso.
          </p>
        </header>
        <UpdatePasswordForm />
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
