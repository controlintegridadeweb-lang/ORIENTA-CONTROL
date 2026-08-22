import type { ReactNode } from "react";
import { requireRole } from "@/infrastructure/auth/current-user";
import { AppShell } from "@/features/app-shell/components/app-shell";

// Toda a área administrativa depende de autenticação e dados do Supabase por
// requisição. Forçar renderização dinâmica impede o Next de executar essas
// páginas (e suas chamadas ao Supabase) durante a coleta de dados do build —
// o que, em ambientes onde o Supabase não responde rápido, pendurava o
// `next build`. O conteúdo nunca foi estático; isto apenas o torna explícito.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireRole(["admin"]);

  return (
    <AppShell
      user={user}
      title="Dashboard"
      description="Indicadores, evidências, ajustes solicitados, pendências e resultado FAMI"
    >
      {children}
    </AppShell>
  );
}
