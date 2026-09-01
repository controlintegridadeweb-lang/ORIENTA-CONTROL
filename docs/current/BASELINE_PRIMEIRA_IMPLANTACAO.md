# Schema oficial para a primeira implantação

## Decisão

A primeira implantação do ORIENTA usa uma **baseline greenfield consolidada**, sem carregar o histórico de correções produzido durante o desenvolvimento.

A antiga sequência `0001`–`0054` foi aposentada como fonte executável. Seu estado final foi consolidado em dez migrations timestampadas e organizadas por dependência. O histórico antigo é mantido apenas como artefato de auditoria externo ao diretório `supabase/migrations/`.

## Sequência canônica em 12/08/2026

```text
20260812000100_extensions_types.sql
20260812000200_schema.sql
20260812000300_relations.sql
20260812000400_read_models.sql
20260812000500_functions.sql
20260812000600_triggers.sql
20260812000700_storage.sql
20260812000800_security_rls.sql
20260812000900_comments.sql
20260812001000_contract_checks.sql
```

A migration `relations` existe para fechar FKs cuja criação depende de ambos os agregados já existirem, como `forms ↔ form_versions`; ela não é uma correção posterior de schema. `read_models` vem antes de `functions` porque RPCs de paginação dependem das views e, por isso, a ordem representa a DAG real de dependências.

## Estado executável atual em 22/08/2026

O diretório `supabase/migrations/` contém **22 migrations**: as 10 migrations imutáveis da baseline acima e 12 evoluções funcionais posteriores. Para criar um Supabase novo, aplique **todas as 22 na ordem do diretório**; não aplique apenas as dez primeiras. O gate `npm run db:audit:migrations` valida esse contrato.

## Dados

Migrations contêm somente schema, segurança, funções e infraestrutura. Dados ficam separados:

- desenvolvimento: `supabase/seeds/`;
- dados iniciais reais de 2026: `data/bootstrap-2026/private/` (somente na distribuição privada) + `npm run bootstrap:2026`;
- Auth: reconciliação por e-mail dentro de `npm run bootstrap:2026`.

Nenhum dado real deve ser versionado dentro das migrations.

## Contratos preservados

- FAMI oficial vigente: `v7`;
- FAMI preliminar quadrimestral é um domínio separado e não sobrescreve o oficial;
- evidência textual faz parte do enum final desde a criação;
- documentos do plano usam `file_validation_status` desde a criação;
- `start_date`, `revision` e carregamento de comprovantes ativos já fazem parte do contrato final;
- RLS, grants, Storage e triggers são instalados somente em seus módulos finais.

## Primeira aplicação

```bash
npm run db:audit:migrations
supabase db reset --local
npm run db:verify
npm run check:generated-types
```

Todos os gates precisam passar antes da carga canônica de 2026.

## Imutabilidade

Enquanto esta baseline não tiver sido aplicada à primeira implantação compartilhada, ela pode ser corrigida como uma unidade consolidada. Depois da primeira aplicação compartilhada, migrations já aplicadas tornam-se imutáveis e novas mudanças passam a ser incrementais.
