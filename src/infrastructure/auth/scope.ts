import type { AppRole } from "./types";

/**
 * Mínimo necessário para decidir o escopo de acesso de uma chamada.
 * Compatível com `AuthContext` (APIs) e com o tipo `Caller` interno dos
 * serviços (`{ role, organizationId }`).
 */
export type CallerScope = {
  role: AppRole;
  organizationId: string | null;
};

/**
 * O ORIENTA possui um único perfil administrativo, global e sem vínculo com
 * organização. O banco reforça essa regra em `0002_organizacoes_perfis_autorizacao.sql`.
 */
export function isGlobalAdmin(scope: CallerScope): boolean {
  return scope.role === "admin";
}

/** Apenas respondentes operam dentro de uma organização específica. */
/** `true` quando o chamador pertence à camada administrativa. */
