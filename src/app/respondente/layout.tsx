import type { ReactNode } from "react";
import { requireRole } from "@/infrastructure/auth/current-user";
import { AppShell } from "@/features/app-shell/components/app-shell";

// Área do respondente: autenticação e dados por requisição. Dinâmico explícito
// evita execução em build-time (mesma razão do layout admin).
export const dynamic = "force-dynamic";

export default async function RespondenteLayout({ children }: { children: ReactNode }) {
  const user = await requireRole(["respondent"]);
  return (
    <AppShell
      user={user}
      title="Área do respondente"
      description="Diagnósticos, evidências, recomendações, Plano de ação, Resultado FAMI, relatórios e perfil"
    >
      {children}
    </AppShell>
  );
}
