# Plataforma ORIENTA

Aplicação de diagnóstico institucional para órgãos públicos, construída com
Next.js, TypeScript e Supabase. O fluxo oficial é:

1. administração estrutura a biblioteca e publica um formulário;
2. cria e abre ciclos para organizações atribuídas;
3. respondentes registram respostas e evidências;
4. administração valida evidências;
5. a administração conclui a validação; nessa mesma operação, o sistema calcula e congela o FAMI, materializa snapshots e recomendações oficiais;
6. o respondente elabora e acompanha o plano de ação a partir do resultado do diagnóstico;
7. após cada quadrimestre encerrado, a administração pode congelar um FAMI preliminar gerencial (`prelim_v1`), com histórico próprio e sem alterar o Resultado FAMI oficial;
8. a administração encerra o ciclo somente após concluir a supervisão das ações, sem recalcular ou sobrescrever o FAMI oficial;
9. relatórios oficiais em PDF são emitidos após o encerramento da avaliação e preservam exclusivamente o processamento FAMI congelado na conclusão da validação.

## Stack

- Next.js (App Router), React, TypeScript e Tailwind CSS;
- Supabase: PostgreSQL, Auth, Storage privado e RLS;
- Vitest para regras de domínio e serviços;
- Playwright para jornadas E2E reais;
- ESLint e TypeScript para qualidade estática.

## Convenções técnicas

- Rotas e textos de interface usam português; módulos técnicos usam inglês.
- A regra de negócio pura fica em `src/shared/domain/`; I/O e Supabase ficam em
  serviços específicos.
- Clientes Supabase são criados apenas pelas factories em `src/infrastructure/supabase/`.
- O estado do ciclo é a fonte de verdade do workflow; formulário é um template.
- APIs operacionais recebem `cycleId`; formulário e organização são sempre derivados no servidor.
- Evidências usam exclusivamente o caminho
  `{organization_id}/{cycle_id}/{arquivo}` no bucket privado `evidencias`.
  Uploads ainda não associados ficam em `pending_evidence_uploads` por até 24
  horas e são promovidos à evidência apenas pela RPC transacional da resposta.
- Comprovações da execução usam
  `{organization_id}/{action_plan_id}/{object_id}-{arquivo}` no bucket privado
  `planos-acao`. O navegador envia o arquivo diretamente por URL assinada; o
  backend registra o upload em `pending_action_plan_document_uploads`, verifica
  tamanho, assinatura e estrutura e o consome por RPC atômica e idempotente. Depois disso, o
  arquivo fica disponível apenas com `file_validation_status = valid` e pertence à revisão da
  ação. A comprovação da execução é opcional e não bloqueia o aceite nem o
  encerramento; quando anexada e aprovada, o conjunto da revisão permanece imutável.
- Exceções institucionais só podem ser solicitadas sem ações ativas. Aprovação
  dispensa a recomendação sem recalcular o FAMI; solicitação pendente bloqueia o
  encerramento do ciclo.
- As mutações de resposta e evidência aceitam exclusivamente o perfil
  respondente; o administrador tem leitura, validação e gestão do ciclo.
- Histórico de relatórios e acompanhamento é paginado no banco, sem limites
  silenciosos que ocultem versões ou registros antigos.
- FAMI é calculado na conclusão da validação do diagnóstico (política v7):
  “Sim” sem exigência de evidência vale 1,0; “Sim” com evidência aprovada
  vale 2,0; “Sim” que exige evidência sem aprovação (pendente, ausente ou
  insuficiente) vale 0, com máximo 2,0. Processamentos históricos preservam a
  política congelada. O plano de ação vem depois e o encerramento da avaliação
  não recalcula nem sobrescreve snapshots oficiais. O acompanhamento quadrimestral
  usa `fami_preliminary_*`, é explicitamente não oficial e possui exportação própria;
  ele nunca entra em `fami_results` nem no PDF oficial.


## Organização do código

```text
src/
├── app/                 # entradas Next.js e composição de páginas
├── application/         # casos de uso que coordenam domínios
├── features/            # domínios funcionais e UI específica
├── infrastructure/      # Supabase, Auth, HTTP, segurança e observabilidade
├── shared/              # domínio comum, utilitários e UI genérica
└── test/                # setup e stubs compartilhados
```

Scripts operacionais são separados por responsabilidade em `scripts/bootstrap`, `scripts/database`, `scripts/imports`, `scripts/maintenance`, `scripts/production`, `scripts/testing`, `scripts/verification` e `scripts/shared`; o mapa completo está em `scripts/README.md`. O schema tem uma única fonte de verdade em `supabase/migrations/`. A carga inicial consolidada do Diagnóstico de Integridade 2026 fica em `data/bootstrap-2026/`, separada do schema e sem carregar o histórico técnico do banco anterior.

## Requisitos

- Node.js 22.16+ (linha 22.x);
- npm 10.9+ (linha 10.x);
- Docker e Supabase CLI para validar banco e Storage localmente;
- variáveis Supabase para executar rotas que acessam banco em runtime.

## Configuração local

```bash
npm ci
cp .env.example .env.local
npm run dev
```

O servidor de desenvolvimento sobe em **http://localhost:3002** (porta definida em
`package.json`). Preencha `.env.local` a partir de `.env.example`. O arquivo tem dois blocos:
runtime (local e Vercel) e chaves só de CLI/backup/smoke. Não cadastre o
segundo bloco na Vercel. `NEXT_PUBLIC_APP_URL` local permanece em
`http://localhost:3002`; a origem HTTPS de produção vai em `PRODUCTION_BASE_URL`.
Confira o conjunto com `npm run check:vercel-env`. O arquivo de exemplo
contém apenas valores de referência e comentários; não use chaves de produção
no repositório. As variáveis Supabase são necessárias para rotas em runtime.
Para scripts de banco, informe uma URL em `SUPABASE_DB_URL`, `DATABASE_URL` ou
`POSTGRES_URL`; a ordem de preferência está comentada no arquivo. Defina também `CRON_SECRET` no ambiente que executará os workers independentes de manutenção; nunca exponha esse valor ao cliente. Uploads de arquivo passam por validação estrutural (PDF, PNG, JPEG, WebP) antes de ficarem disponíveis; a plataforma não realiza varredura antimalware nesta versão. `NOTIFICATION_WEBHOOK_URL` e `NOTIFICATION_WEBHOOK_SECRET` são opcionais para entrega externa; sem elas, os avisos internos continuam ativos e os itens da fila externa são cancelados com motivo explícito.

## Deploy (Vercel)

O projeto já inclui `vercel.json` (Next.js, região `gru1`, workers separados para operações de ciclo, importações, pacotes de relatórios, notificações e limpeza). Passo a passo, variáveis obrigatórias e
ajustes no Supabase Auth estão em
[`docs/current/DEPLOY.md`](docs/current/DEPLOY.md).

## Banco de dados

Há **21 migrations timestampadas** em `supabase/migrations/`: 10 migrations imutáveis da baseline greenfield, já validadas em PostgreSQL 17 real, mais 11 evoluções pós-baseline para alteração de prazo, FAMI preliminar, exportação/monitoramento, reparo controlado da carga 2026, listagem de respondentes, progresso monotônico do plano de ação, integridade do encerramento com emissão oficial automática, leitura do estado do ciclo no rascunho de validação, comprovação opcional da execução no aceite/encerramento e acompanhamento bimestral com FAMI preliminar `prelim_v2` — ver
[`docs/current/BANCO.md`](docs/current/BANCO.md) e
[`docs/current/BASELINE_PRIMEIRA_IMPLANTACAO.md`](docs/current/BASELINE_PRIMEIRA_IMPLANTACAO.md). A validação da baseline em PostgreSQL real está documentada em [`docs/current/VALIDACAO_BASELINE_POSTGRESQL.md`](docs/current/VALIDACAO_BASELINE_POSTGRESQL.md).
A sequência antiga `0001`–`0054` foi aposentada como fonte executável antes da primeira implantação. A baseline atual nasce diretamente no estado final, em ordem de dependências, sem patches, backfills históricos ou migrations corretivas intermediárias.

Para subir e validar a stack local:

```bash
npm run db:audit:migrations
npm run supabase:start:clean
npm run db:reset:local
npm run supabase:env:local
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres SUPABASE_GEN_TYPES_MODE=local npm run check:generated-types

# A função de bootstrap do Diagnóstico 2026 é fixture exclusiva de integração/E2E.
# Ela é instalada somente depois do check de tipos para não contaminar o contrato canônico.
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run supabase:fixture:diagnostic
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres DB_VERIFY_ONLY=1 npm run db:verify
npm run db:verify:reports

# Desenvolvimento local: contas exclusivamente fictícias do seed versionado
npm run bootstrap:respondents -- --dry-run
npm run bootstrap:respondents

# Primeira implantação real de 2026 no novo Supabase (HTTPS)
npm run bootstrap:2026:verify
npm run db:push:api
npm run bootstrap:2026:dry-run
npm run bootstrap:2026
```

A ordem e as responsabilidades estão em
[`supabase/migrations/README.md`](supabase/migrations/README.md). Depois da
primeira aplicação em banco compartilhado, os arquivos executados tornam-se
imutáveis e mudanças futuras devem usar novas migrations incrementais.

## Primeiro acesso

O primeiro acesso, incluindo organizações, primeiro administrador, formulários e respondentes, está em
[`docs/current/PRIMEIRO_ACESSO.md`](docs/current/PRIMEIRO_ACESSO.md).

## Qualidade

```bash
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
npm run check:dead-code
npm run check:architecture
npm run check:security-sync
npm run check:sensitive-artifacts
npm run check:visual-consistency
npm run check:complexity
npm run check:respondent-seed
npm run check:diagnostic-import
npm run security:mfa-recover -- --help  # consulte docs/current/MFA_RECOVERY.md
```

O `npm run build` executa `next typegen` e `tsc --noEmit` antes do bundler e o
Next.js também permanece configurado para falhar diante de erros TypeScript. O CI
aplica timeout explícito ao build. No job
de banco, `check:generated-types` gera um contrato temporário com o Supabase CLI
oficial e verifica compatibilidade estrutural bidirecional com o arquivo
versionado; diferenças reais de tabelas, views, funções, enums ou nulabilidade
quebram o pipeline sem produzir falsos diffs de formatação.

No Vitest 4, os arquivos definidos em `coverage.include` entram no relatório
mesmo quando nenhum teste os importa. O escopo do núcleo determinístico possui
pisos de **70%** em linhas e statements, **75%** em funções e **60%** em
branches; rotas críticas também possuem testes diretos de contrato, enquanto UI, RLS e Storage são cobertos pelas verificações SQL e E2E.


## Documentação técnica

- [`docs/current/ARQUITETURA.md`](docs/current/ARQUITETURA.md): arquitetura vigente, fronteiras e inventário verificável.
- [`docs/current/decisions/README.md`](docs/current/decisions/README.md): decisões arquiteturais vigentes e consequências.
- [`docs/current/FLUXO_OPERACIONAL.md`](docs/current/FLUXO_OPERACIONAL.md): sequência canônica entre os perfis.
- [`docs/current/DEPLOY.md`](docs/current/DEPLOY.md): publicação na Vercel,
  variáveis de ambiente e Auth do Supabase.
- [`docs/current/SEGURANCA.md`](docs/current/SEGURANCA.md): modelo de
  autorização, RLS e validação local.
- [`docs/current/MFA_RECOVERY.md`](docs/current/MFA_RECOVERY.md): recuperação administrativa de MFA com simulação e auditoria append-only.
- [`docs/current/VERIFICACAO_BANCO_E_STORAGE.md`](docs/current/VERIFICACAO_BANCO_E_STORAGE.md):
  verificadores SQL, Storage e relatórios.
- [`docs/current/MANUTENCAO.md`](docs/current/MANUTENCAO.md): guia de manutenção para agentes e pessoas
  que alterem o repositório.
- [`docs/current/BANCO.md`](docs/current/BANCO.md): decisão de
  consolidação, contrato da instalação limpa e validação em banco real.
- [`docs/current/CARGA_RESPONDENTES_SUPABASE.md`](docs/current/CARGA_RESPONDENTES_SUPABASE.md):
  seed administrativo idempotente de organizações, contas Auth e profiles.
- [`docs/current/IMPORTACAO_DIAGNOSTICO_2026.md`](docs/current/IMPORTACAO_DIAGNOSTICO_2026.md):
  conciliação, normalização, auditoria e carga das respostas históricas.

## E2E de navegador

A suíte E2E usa Playwright, autenticação real e Supabase local. Ela não utiliza
mocks de rotas, bypass de sessão nem banco remoto. O setup cria exclusivamente
as contas técnicas `admin.e2e@orienta.local`, `respondente.e2e@orienta.local`
e `respondente.externo.e2e@orienta.local`. As duas últimas ficam em organizações
distintas, permitindo provar isolamento entre tenants; o setup também instala o
catálogo necessário para o wizard de formulário.

```bash
supabase start
supabase db reset --local

eval "$(supabase status -o env | sed -E 's/^([^=]+)=(.*)$/export \1=\2/')"
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export NEXT_PUBLIC_APP_URL="http://localhost:3002"

npm run e2e:prepare
npx playwright install chromium
npm run test:e2e
```

Os cenários canônicos cobertos são: login por papel; criação, configuração e
publicação de formulário; criação e abertura de diagnóstico; upload real de
arquivo no Storage; bloqueio de acesso por organização externa; solicitação de
ajuste e correção pelo respondente; validação concluída com FAMI, snapshots e recomendações oficiais; criação de ação do
plano; encerramento posterior do ciclo sem recálculo; emissão, versionamento e download do relatório PDF, com aviso ao respondente somente após a conclusão criptograficamente validada do arquivo;
bloqueio de edição após a conclusão e retomada de edição após reabertura. O job
`end-to-end` do CI roda esses cenários contra uma stack Supabase local isolada.
Falhas não têm retry automático para não ocultar instabilidade.

## Importação histórica do Diagnóstico de Integridade 2026

A planilha histórica é convertida diretamente para o contrato de importação v2.
As respostas, os dados funcionais do respondente, os textos auxiliares e os
links reais são preservados no domínio normal da plataforma. Não existe tabela,
menu, bloqueio ou fila paralela exclusiva para saneamento histórico.

```bash
npm run build:diagnostic-import-manifest -- \
  --file /caminho-seguro/informações.xlsx \
  --output /caminho-seguro/diagnostico_integridade_2026.json

npm run verify:diagnostic-import -- \
  --file /caminho-seguro/diagnostico_integridade_2026.json \
  --accounts-file /caminho-seguro/respondentes.csv
```

Somente URLs vinculadas a respostas normalizadas como `Sim` viram evidências.
URLs informadas em respostas `Não` permanecem nas notas históricas, sem serem
convertidas em evidências ativas. Uma resposta `Sim` sem link não gera dado
fictício nem erro de importação: ela segue a regra FAMI e o fluxo comum de
validação da plataforma.

A baseline fecha a integridade temporal dos diagnósticos: alterações de datas
substituem os jobs na mesma transação, reaberturas exigem justificativa e novo
prazo, envios atrasados ficam auditados, automações condicionais são retomadas
até o diagnóstico ficar apto e arquivos de evidência só ficam disponíveis após
validação estrutural com `file_validation_status = valid`.

## Operação de produção

- [Prontidão para produção](docs/current/PRODUCTION_READINESS.md)
- [Deploy](docs/current/DEPLOY.md)
- [Backup e restore](docs/current/BACKUP_RESTORE.md)
- [Rollback](docs/current/ROLLBACK.md)
- [Resposta a incidentes](docs/current/INCIDENT_RESPONSE.md)

### Etapa 3 — Clean Code e complexidade (2026-08-12)

O gate `npm run check:complexity` está aprovado sem aumento de limites. A
refatoração separou read models de evidências, apresentação/decisão de documentos,
detalhes de evidência do respondente, testes do `EvidenceCard` e validação de
identidade do script administrativo CBM/RN. Esse orçamento permanece protegido por `npm run check:complexity`; relatórios históricos de refatoração não fazem parte da documentação normativa corrente.
