"use client";

import { useEffect } from "react";
import { typography } from "@/shared/layout/design-system";
import { formSurface } from "@/shared/layout/form-surface";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erro de rota", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-start justify-center gap-4 px-6">
      <p className={typography.errorText}>Não foi possível concluir a operação</p>
      <h1 className={typography.pageTitle}>Ocorreu um erro inesperado.</h1>
      <p className={typography.pageDescription}>
        Tente novamente. Se o problema continuar, volte ao painel e informe o código abaixo à equipe responsável.
      </p>
      {error.digest ? (
        <p className={typography.meta}>Código: {error.digest}</p>
      ) : null}
      <button type="button" onClick={reset} className={formSurface.primaryButton}>
        Tentar novamente
      </button>
    </main>
  );
}
