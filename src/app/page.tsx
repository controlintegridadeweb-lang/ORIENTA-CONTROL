import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/components/login-form";
import { AuthSplitLayout } from "@/features/auth/components/auth-split-layout";
import {
  CurrentUserProfileError,
  getCurrentUser,
  homeRouteForRole,
} from "@/infrastructure/auth/current-user";
import { logError } from "@/infrastructure/observability/logger";
import { typography } from "@/shared/layout/design-system";

// Lê a sessão por requisição; não pode ser prerenderizada no build.
export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const missingEnv = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ].filter((key) => !process.env[key]?.trim());

  if (missingEnv.length > 0) {
    logError("Home: configuração obrigatória ausente", new Error("Missing environment configuration"), {
      where: "Home",
      missingEnvironmentVariables: missingEnv,
    });
    return (
      <main className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-start justify-center gap-4 px-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">
          Serviço temporariamente indisponível
        </p>
        <h1 className={typography.pageTitle}>
          Não foi possível iniciar a plataforma.
        </h1>
        <p className={typography.pageDescription}>
          Tente novamente em alguns instantes. Caso o problema continue, informe o código
          <strong> ORIENTA-CONFIG</strong> à equipe responsável.
        </p>
      </main>
    );
  }

  let user = null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (!(error instanceof CurrentUserProfileError)) throw error;
    logError("Home: falha ao carregar perfil; exibindo login", error, {
      where: "Home",
    });
  }
  if (user) redirect(homeRouteForRole(user.role));

  const params = await searchParams;
  const redirectTo = typeof params.redirect === "string" ? params.redirect : undefined;

  return (
    <AuthSplitLayout>
      <LoginForm redirectTo={redirectTo} />
    </AuthSplitLayout>
  );
}
