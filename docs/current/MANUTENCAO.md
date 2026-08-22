# Guia de manutenção — ORIENTA

> Guia de contexto para pessoas e agentes de IA que alterem este repositório.

## Projeto

A Plataforma ORIENTA gerencia diagnósticos institucionais, evidências,
validação, FAMI, recomendações, planos de ação, supervisão e relatórios.

Stack: **Next.js 16 · TypeScript · Supabase · Tailwind v4 · Vitest · Playwright**.

## Estrutura rápida

```text
src/
├── app/                 # Entradas Next.js e composição
├── application/         # Casos de uso entre domínios
├── features/            # Domínios e UI específica
├── infrastructure/      # Supabase, Auth, HTTP, segurança e observabilidade
├── shared/              # Domínio comum, utilitários e UI genérica
└── test/                # Setup e stubs de teste

scripts/
├── bootstrap/
├── database/
├── data-migration/      # único pipeline greenfield (lib/tools/export/import/validate)
├── imports/
├── production/
├── quality/
├── security/
├── shared/
└── testing/
```

## Regras de localização

1. Código específico pertence a `src/features/<domínio>/`.
2. UI específica fica em `src/features/<domínio>/components/`.
3. UI genérica sem dependência de feature fica em `src/shared/ui/`.
4. Um componente usado por outra feature deve ser exposto pela API pública
   `src/features/<domínio>/ui.ts`.
5. Casos de uso que coordenam mais de um domínio ficam em `src/application/`.
6. Regras puras e utilitários reutilizáveis ficam em `src/shared/`.
7. Supabase, autenticação, segurança, telemetria e adaptadores ficam em
   `src/infrastructure/`.
8. Não recrie `src/components`, `src/presentation` ou `src/lib`.
9. Testes ficam ao lado do domínio, em `*.test.ts`, `*.test.tsx` ou na pasta
   local `tests/`. `src/test/` é reservado ao setup compartilhado.
10. Features não podem formar ciclos de dependência.

## Regras críticas

1. Nunca commitar `.env*.local`, `node_modules/`, `.next/`, caches ou
   credenciais.
2. Dados históricos são temporários em `var/imports/` e não pertencem ao deploy.
3. Autenticação em API usa `requireAuth` ou `withRoute`.
4. Toasts usam `notify` de `@/infrastructure/notifications/notify`.
5. O FAMI preserva os pesos oficiais vigentes (v7): 1,0 sem evidência; 2,0 somente
   com evidência aprovada; sem aprovação em critério que exige evidência = 0
   (máximo 2,0). Históricos v3–v6 permanecem congelados no processamento.
6. Erros de RPC são reconhecidos por
   `infrastructure/supabase/database-error.ts`, nunca por comparação livre
   espalhada em cada serviço.
7. Arquivos `route.ts` devem ser finos. Schemas e casos de uso extensos pertencem
   à feature ou a `application`.

## Orçamento de complexidade

```bash
npm run check:architecture
npm run check:complexity
node scripts/verification/check-complexity.mjs --report
```

- arquivo manual em `src`, `scripts` ou `e2e`: máximo de **600 linhas**;
- função produtiva: máximo de **375 linhas**;
- jornada E2E: máximo de **500 linhas**;
- unidade React: até **10 `useState`** e **6 `useEffect`**;
- mais de **35 arquivos diretos** em uma pasta gera informação estrutural;
- tipos gerados são excluídos apenas do limite de tamanho manual;
- imports locais quebrados, ciclos, imports profundos entre features,
  dependências invertidas e contratos HTTP sem validação bloqueiam o CI.

Não aumente limites para evitar uma refatoração necessária.

## Documentação principal

| Caminho | Conteúdo |
|---|---|
| `README.md` | Setup local e comandos principais |
| `docs/current/ARQUITETURA.md` | Árvore e fronteiras técnicas |
| `docs/current/DEPLOY.md` | Deploy, variáveis e Auth |
| `docs/current/PRIMEIRO_ACESSO.md` | Bootstrap inicial |
| `docs/current/SEGURANCA.md` | RLS, service role e isolamento |
| `supabase/migrations/README.md` | Ordem e política das migrations |
| `src/features/fami/README.md` | Regra FAMI |
| `src/features/library/README.md` | Biblioteca de critérios |
| `src/shared/layout/README.md` | Sistema de layout |
