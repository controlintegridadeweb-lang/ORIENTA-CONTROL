# Banco de dados — baseline greenfield

## Fonte oficial

A única fonte executável do schema é `supabase/migrations/`, com **18 migrations timestampadas**: 10 migrations imutáveis da baseline greenfield (`20260812000100` a `20260812001000`) e 8 evoluções pós-baseline (`20260812001100` a `20260822190000`). O intervalo completo é `20260812000100` a `20260822190000`.

A sequência evolutiva antiga `0001`–`0054` não participa mais da instalação. Ela foi consolidada antes da primeira implantação para evitar que um banco novo reproduza patches, backfills e correções intermediárias.

## Contratos estruturais

- 58 tabelas públicas no estado final esperado;
- 197 funções conhecidas no schema final, incluindo 133 funções/RPCs públicas não-trigger representadas em `database.types.ts`;
- 6 views/read models públicos;
- 93 triggers finais;
- FAMI oficial `v7`; a carga inicial de 2026 não transporta séries técnicas de políticas anteriores;
- FAMI preliminar quadrimestral em estruturas separadas do oficial;
- RLS habilitado conforme modelo de autorização;
- buckets privados para evidências, planos de ação e relatórios;
- evidências/arquivos somente disponibilizados após validação estrutural;
- auditoria append-only;
- concorrência otimista por `revision` nos fluxos críticos.

## Instalação limpa

1. Aplicar as 18 migrations em banco vazio.
2. Regenerar `database.types.ts` a partir desse banco.
3. Executar verificadores SQL, RLS, Storage e advisors.
4. Não executar seeds de desenvolvimento na implantação real.
5. Executar `npm run bootstrap:2026` para Auth e dados atuais de 2026.
6. Executar verificações de integridade e E2E antes do go-live.

```bash
npm run db:audit:migrations
npm run supabase:start:clean
npm run db:reset:local
npm run supabase:env:local
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres SUPABASE_GEN_TYPES_MODE=local npm run check:generated-types
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run supabase:fixture:diagnostic
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres DB_VERIFY_ONLY=1 npm run db:verify
npm run db:verify:reports
npm run lint
npm run typecheck
npm test
npm run build
```

## Alteração formal de prazo

`action_plans.due_date` não pode ser modificado diretamente após a criação da ação. O respondente registra uma solicitação em `action_plan_deadline_change_requests`, com novo prazo e justificativa; somente a aprovação administrativa pela RPC `decide_action_plan_deadline_change` altera o prazo vigente. Rejeições e aprovações permanecem auditáveis.

## Limite de alteração

Após a primeira aplicação compartilhada, migrations já aplicadas não podem ser reescritas, renumeradas ou removidas. Qualquer evolução futura deve criar uma nova migration timestampada.
