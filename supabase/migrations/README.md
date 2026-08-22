# Migrations do ORIENTA

Este diretório contém **17 migrations SQL timestampadas**: as 10 primeiras formam a baseline canônica validada da primeira implantação e permanecem imutáveis; as seguintes são evoluções pós-baseline.

Não há migrations corretivas, backfills históricos ou dados reais neste diretório. A sequência atual vai de `20260812000100` a `20260821190000`.

## Ordem canônica

| Migration | Responsabilidade |
|---|---|
| `20260812000100_extensions_types.sql` | Extensões, enums e tipos finais. |
| `20260812000200_schema.sql` | Tabelas, constraints locais e índices no estado final. |
| `20260812000300_relations.sql` | FKs/constraints que fecham dependências cíclicas entre agregados. |
| `20260812000400_read_models.sql` | Helpers puros e views/read models finais, todos com `security_invoker = true`. |
| `20260812000500_functions.sql` | Funções/RPCs finais; helpers de autorização privilegiados vivem em `app_private`. |
| `20260812000600_triggers.sql` | Triggers finais e integração Realtime. |
| `20260812000700_storage.sql` | Buckets privados e configuração estrutural do Storage. |
| `20260812000800_security_rls.sql` | Grants, revokes, RLS e policies finais. |
| `20260812000900_comments.sql` | Comentários de catálogo/documentação do banco. |
| `20260812001000_contract_checks.sql` | Asserts de contrato da baseline e reload do schema PostgREST. |
| `20260812001100_action_plan_deadline_change_requests.sql` | Solicitação, decisão administrativa, RLS e auditoria para alteração do prazo de conclusão de ações. |
| `20260813000100_fami_preliminary_open_period_and_close.sql` | Cálculo do FAMI preliminar no período aberto, snapshot imutável no corte e fechamento automático. |
| `20260814000100_action_plan_monitoring_export_fields.sql` | Inclui início da ação e ordem oficial de seção/pergunta na RPC de monitoramento do plano de ação. |
| `20260819000100_repair_cycles_manual_fami_workspace.sql` | Reparo da carga 2026: processamentos ausentes, FAMI oficial só por validação manual e prazo do período. |
| `20260819120000_list_organization_respondents_profiles.sql` | Lista responsáveis do órgão a partir de `public.profiles`, sem depender do RLS de `auth.users`. |
| `20260820120000_action_plan_progress_monotonic.sql` | Impede redução do percentual persistido da ação; o andamento só avança. |
| `20260821190000_report_closure_emission_integrity.sql` | Coordena encerramento, emissão oficial, falhas auditáveis e bloqueio de reabertura sem documento preservado. |

## Regras

- migrations usam timestamp de 14 dígitos, compatível com o histórico do Supabase CLI;
- schema vigente nasce diretamente com FAMI oficial `v7`;
- `cycle_processings` continua aceitando identificadores históricos `v3`–`v7` e pesos congelados 1,5/2 para importação sem recalcular o passado;
- FAMI preliminar permanece em tabelas/RPC próprios e não altera `fami_results`;
- `evidence_kind` já nasce com `text`;
- `action_plan_documents` já nasce com `file_validation_status`; não existe `malware_scan_*`;
- `action_plans` já nasce com `start_date` e concorrência por `revision`;
- a carga inicial real de 2026 entra somente por `data/bootstrap-2026/` + `scripts/bootstrap/import-2026.mjs`;
- seeds em `supabase/seeds/` são apenas para desenvolvimento/reset e não participam do cutover histórico.

## Aplicação e validação

```bash
npm run db:audit:migrations
supabase db reset --local
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run gen:types
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run check:generated-types
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run db:verify
```

Na primeira implantação com os dados reais de 2026, **não use seeds de desenvolvimento**. Aplique o schema em banco novo e execute `npm run bootstrap:2026`.

As 10 migrations da baseline (`20260812000100`–`20260812001000`) são imutáveis. Evoluções futuras seguem como migrations incrementais timestampadas posteriores; a primeira é `20260812001100_action_plan_deadline_change_requests.sql`.
