import Link from "next/link";
import { typography } from "@/shared/layout/design-system";
import { formSurface } from "@/shared/layout/form-surface";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-start justify-center gap-4 px-6">
      <p className={typography.panelEyebrow}>Página não encontrada</p>
      <h1 className={typography.pageTitle}>Este endereço não está disponível.</h1>
      <p className={typography.pageDescription}>
        O conteúdo pode ter sido removido, não estar disponível para seu perfil ou o link pode estar incompleto.
      </p>
      <Link href="/" className={formSurface.primaryButton}>
        Voltar ao início
      </Link>
    </main>
  );
}
