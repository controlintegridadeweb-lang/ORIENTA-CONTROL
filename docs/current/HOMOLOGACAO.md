# Homologação — ORIENTA TESTES

Produção e homologação são projetos Supabase diferentes. O arquivo `.env.local` continua sendo o projeto oficial e não é destino de teste. A homologação usa `.env.homologacao.local`, que o Git ignora.

O Next.js não carrega `.env.homologacao.local`. Os comandos desta página leem esse arquivo, gravam os valores no processo e fazem esses valores prevalecerem sobre variáveis que já existam, inclusive as que o Next leria de `.env.local`.

Não há seleção automática de projeto e não há parâmetro para desligar a verificação. Em dúvida, o comando para.

## O que cada ambiente guarda

| | Produção — ORIENTA OFICIAL | Homologação — ORIENTA TESTES |
| --- | --- | --- |
| Arquivo local | `.env.local` | `.env.homologacao.local` |
| Dados | órgãos, usuários e diagnósticos reais | somente dados fictícios |
| Servidor Next | `npm run dev` na porta 3002 | `npm run dev:homologacao` na porta 3003. A jornada Playwright usa a build de produção em `npm run start:homologacao` |
| Testes de escrita | bloqueados | `ORIENTA_TARGET=homologacao` |
| Stack Docker local | `ORIENTA_TARGET=local`, Postgres em `127.0.0.1:54322` | não substitui o projeto hospedado |

O alvo `local` existe para o Supabase Docker já usado no CI. Ele só aceita `127.0.0.1` ou `localhost` na porta 54322. Um endereço `supabase.co` nunca passa como local.

## Criar o projeto

1. No painel do Supabase, crie um projeto vazio. O nome sugerido é `orienta-testes`; use o nome e o ref que o painel gerar.
2. Não restaure backup, dump ou CSV da produção.
3. Anote o ref do projeto oficial a partir da URL pública já usada em `.env.local` (`https://<ref>.supabase.co`). O ref não é segredo. As chaves são.
4. Copie `.env.homologacao.example` para `.env.homologacao.local`.
5. Preencha, só nesse arquivo:
   - `ORIENTA_HOMOLOGACAO_PROJECT_REF`: os 20 caracteres do projeto novo;
   - `ORIENTA_PRODUCTION_PROJECT_REF`: os 20 caracteres do projeto oficial;
   - `NEXT_PUBLIC_SUPABASE_URL`: `https://<ref-de-homologacao>.supabase.co`;
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` do projeto novo;
   - `DATABASE_URL` ou `SUPABASE_DB_URL` do projeto novo;
   - `NEXT_PUBLIC_APP_URL=http://127.0.0.1:3003`.
6. No pooler, o usuário precisa ser `postgres.<ref>`. O hostname `*.pooler.supabase.com` é compartilhado e não identifica o projeto. Na conexão direta, o host é `db.<ref>.supabase.co`. Se as duas URLs existirem, elas precisam apontar para o mesmo ref.
7. Confira sem abrir conexão:

```bash
npm run homologacao:check
```

A saída mostra o ref, o host do Supabase e o host do Postgres. Ela não mostra chaves nem senha. Se o ref da URL, o ref do Postgres e o ref declarado divergirem, ou se qualquer um for o ref oficial, o comando termina com erro.

## Painel do Supabase

As migrações instalam tabelas, funções, RLS, grants e os buckets privados `evidencias`, `planos-acao` e `relatorios`. Elas não reproduzem a configuração de Auth do painel. No projeto novo:

- desligue o cadastro público;
- mantenha o login por e-mail e senha;
- a confirmação de e-mail pode ficar desligada para as contas criadas pela Admin API, que já nascem confirmadas;
- senha mínima de 12 caracteres, com maiúsculas, minúsculas, dígitos e símbolo;
- sessão com limite de 12 horas e inatividade de 2 horas, como em `supabase/config.toml`;
- MFA TOTP ligado; MFA por telefone desligado;
- URLs de redirecionamento: `http://127.0.0.1:3003`, `http://127.0.0.1:3003/auth/update-password`, `http://localhost:3003` e `http://localhost:3003/auth/update-password`;
- não configure SMTP com credencial de produção. Convites e recuperação de senha só funcionam com um SMTP próprio da homologação.

Os buckets nascem privados, com limite de 20 MiB em evidências e planos. A aplicação gera URL assinada; não torne bucket público para “facilitar” o teste.

## Migrações

Antes de aplicar, `npm run homologacao:check` precisa passar. A aplicação é explícita e pede confirmação:

```bash
# no .env.homologacao.local
# ORIENTA_HOMOLOGACAO_CONFIRM=aplicar-homologacao:<ref-de-homologacao>
npm run db:push:homologacao
```

O comando imprime o ref afetado e aplica somente `supabase/migrations`, na ordem dos 27 arquivos. Não lê a produção. `npm run db:push` continua apontando para `.env.local` e recusa rodar quando `ORIENTA_TARGET=homologacao`.

Depois de uma migração nova no repositório, rode de novo `npm run db:push:homologacao` no projeto de testes. Não reescreva migração já aplicada.

`npm run db:reset:api` apaga o schema do projeto que estiver carregado. Ele agora exige `ORIENTA_RESET_CONFIRM=reset:<ref>` e não faz parte da homologação.

## Dados fictícios

Há um único papel administrativo (`admin`) e o papel `respondent`. Titular e suplente são o campo `respondent_profile_details.appointment`, não papéis novos.

```bash
npm run e2e:prepare:homologacao
```

Esse comando instala a fixture do catálogo de diagnóstico e grava, de forma idempotente:

- órgão “Órgão de Teste E2E”, com `respondente.e2e@orienta.local` (titular) e `suplente.alfa@orienta.test` (suplente);
- órgão “Órgão Externo E2E”, com `respondente.externo.e2e@orienta.local` (titular) e `suplente.beta@orienta.test` (suplente);
- administrador `admin.e2e@orienta.local`.

A senha é `E2E_PASSWORD` ou, se ela estiver vazia, a senha fictícia já usada pela jornada. Ela não é credencial de produção. O comando não a imprime.

Respostas, recomendações, ações e acompanhamentos não são inseridos por esse seed. Criá-los direto no SQL desligaria a máquina de estados. Eles passam a existir quando a jornada Playwright roda no projeto de homologação.

## Testes

```bash
npm run test:e2e:homologacao
npm run homologacao:limpeza-previa
```

Os 37 arquivos de `supabase/verify` pertencem ao job isolado `database-integration`. `npm run db:verify:homologacao` e `npm run homologacao:validar` apontam essa suíte para o Postgres hospedado, inclusive os arquivos que executam `commit`. Eles não declaram o resultado do CI. `db:verify:reports:homologacao` envia um PDF fictício ao Storage de homologação; não substitui os verificadores SQL.

`npm run homologacao:confirmar` relê as contas, os órgãos, os três eixos e os 126 critérios. Não renomeia nem apaga formulários. Cada execução da jornada grava o próprio nome `Diagnóstico E2E - Jornada Canônica <identificador>`, dentro do limite de 200 caracteres, e o próprio período, dentro do limite de 60. A unicidade de `forms.name` continua sendo a do produto. `npm run homologacao:limpeza-previa` só lê. Recusa `--execute` e qualquer projeto que não seja `fqexokfsjadrbrvcsfax`. Um formulário entra na seleção comprovada quando o nome e o período trazem o mesmo identificador da jornada (`E2E <id>` ou `E2E <id> percentual`) e o ciclo pertence a um dos dois órgãos fictícios. Nome só por prefixo, rascunho interrompido ou período diferente ficam em revisão manual. A prévia não pausa ciclo, não altera estado e não chama `delete_unpublished_form` nem `admin_delete_suspended_form`. A auditoria permanece: o gatilho `audit_logs_append_only_update_delete` recusa alteração e exclusão. Arquivo compartilhado com registro de fora da seleção comprovada bloqueia a leitura. `npm run test:e2e:homologacao` executa essa conferência, gera `next build --webpack` com o ambiente de homologação e só então sobe `next start` na porta 3003. O `webServer` do Playwright não reutiliza um processo já existente e não usa `next dev`, para a jornada não esperar a compilação da primeira visita. Ele não reutiliza `localhost:3002`. A build é recusada se o pacote contiver o ref do projeto oficial. A jornada cobre login, diagnóstico, arquivo privado, recomendação, plano, validação administrativa, bloqueio de edição e a recusa de acesso do outro órgão. Entre os passos, o Playwright limpa os cookies do navegador e restaura a sessão já autenticada, sem clicar em Sair: a rota de login aceita 8 tentativas por conta a cada 15 minutos, e uma suíte completa ultrapassa esse teto se cada troca de papel abrir uma sessão nova. O cadastro de membro, o relatório com URL assinada e o acompanhamento percentual em ciclo validado estão em arquivos Playwright separados, com formulário e período próprios. A diferença visual entre titular e suplente não é uma regra de autorização: o vínculo é `respondent_appointment`.

O alvo local, usado pelo CI, fica explícito:

```bash
ORIENTA_TARGET=local DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres DB_VERIFY_ONLY=1 npm run db:verify
```

## Falha de conexão

- “`.env.homologacao.local` ausente”: o arquivo não foi criado.
- “ausente ou inválido”: ref vazio ou diferente de 20 letras minúsculas e dígitos.
- “não corresponde”: URL, usuário do pooler ou host direto apontam para outro projeto.
- “projeto oficial”: o destino coincide com `ORIENTA_PRODUCTION_PROJECT_REF` ou com o ref de `.env.local`.
- “não identifica o projeto”: a conexão do pooler está só com o usuário `postgres`, sem `postgres.<ref>`.
- “Operação destrutiva bloqueada”: falta `ORIENTA_HOMOLOGACAO_CONFIRM`.
- porta 3003 ocupada: o comando não cai para a 3002. Encerre o processo da 3003 e rode de novo.

## CI — verificadores SQL

O workflow `.github/workflows/ci.yml` dispara em pull request, push da branch `main` e `workflow_dispatch`. No commit `eec80be`, o job `database-integration` usa `ubuntu-latest` e `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Ele não recebe segredo do projeto `fqexokfsjadrbrvcsfax` nem do projeto oficial.

Para acioná-lo no GitHub: Actions, workflow CI, Run workflow, branch desejada. Também roda sozinho ao abrir um pull request. Nesta estação não há Docker nem GitHub CLI, então a suíte não foi executada aqui. O job do commit `eec80be` concluiu com sucesso na execução [40354605486](https://github.com/controlintegridadeweb-lang/ORIENTA-CONTROL/actions/runs/40354605486), nos três jobs `quality`, `database-integration` e `end-to-end`. Esse resultado não cobre alterações locais posteriores e não é substituído por uma prévia de limpeza.

O job faz, nesta ordem:

1. `npm ci`
2. `npm run db:audit:migrations`
3. `npm run supabase:start:clean`, com Docker e sem studio, imgproxy, mailpit, logflare e vector
4. `npm run db:reset:local`, que aplica as 27 migrações de `supabase/migrations` no Postgres `127.0.0.1:54322`
5. `npm run supabase:env:local` e a conferência dos tipos gerados
6. `npm run supabase:fixture:diagnostic`
7. `DB_VERIFY_ONLY=1 npm run db:verify`, com `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Esse modo não reaplica migração. Executa `_seed_minimal.sql` e, em seguida, os outros 36 arquivos de `supabase/verify`, em ordem alfabética.
8. `npm run db:verify:reports` contra `http://127.0.0.1:54321`
9. `supabase stop --no-backup`, sempre, inclusive após falha

`action_plan_progress_monotonic.sql` e `action_plans_cycle_editability.sql` executam `commit`. `_seed_minimal.sql` grava eixos, usuário, organização e um ciclo. Esses dados nascem no volume local e desaparecem no `stop --no-backup`. Não rode `npm run db:verify:homologacao` para obter esse resultado: esse comando aponta para o Postgres hospedado.

O comando local, quando o Docker já está no ar e o schema foi resetado, é:

```bash
ORIENTA_TARGET=local DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres DB_VERIFY_ONLY=1 npm run db:verify
```

## Retenção dos dados E2E

A prévia `npm run homologacao:limpeza-previa` não autoriza exclusão. `--execute` continua recusado. A única exclusão de coleta publicada é `admin_delete_suspended_form`, e ela só aceita coleta já suspensa pela regra do produto. Este procedimento não pausa ciclos para chegar a essa condição. Formulário validado, concluído ou em validação não é apagado por SQL avulso. Formulário sem o par nome/período da jornada fica em revisão manual. Não há RPC destrutiva nova. Uma política futura de retenção precisa de avaliação e aprovação próprias.

## Registro — 26 de outubro de 2026

A estação usou ORIENTA `1.0.0-rc.1`, Next.js `16.4.2`, Vitest `4.1.12` e Playwright `1.61`. O CI lê `.node-version` (`22.23.2`). Esta máquina executou os testes com Node `v24.14.1` e npm `11.11.0`, fora da faixa declarada em `engines`. Docker e GitHub CLI não estão instalados.

A reabertura do diagnóstico concluído tem um campo, com o rótulo `Justificativa da reabertura`, dentro da região `Reabertura do diagnóstico`. O Playwright exige essa região uma vez. A situação administrativa é lida no `main` e a leitura se repete até o painel estabilizar. A prévia de limpeza lista dependências, arquivos de Storage e a ordem segura. Ela recusa `--execute`.

Uma passagem anterior do Playwright, ainda neste workspace e antes da consolidação, fechou 14 testes na porta 3003, no projeto `fqexokfsjadrbrvcsfax`. Ela não foi repetida na consolidação. A consolidação, com Node `v24.14.1`, aprovou arquitetura, complexidade, sincronização de segurança, artefatos sensíveis, lint, typecheck, Vitest (368 arquivos, 1870 aprovados e 1 ignorado) e `next build --webpack`. A primeira tentativa de código morto esgotou a memória do processo; a repetição isolada passou. Esses números não substituem o CI de `eec80be`.

A prévia relida em 26 de outubro de 2026, sem exclusão e sem bloqueio, separou 17 formulários comprovados pelo identificador da execução e 5 formulários em revisão manual. Nenhum dos 17 está elegível para `admin_delete_suspended_form`: 7 ainda têm coleta aberta sem pausa e 10 já não estão em preenchimento ou correção. A tabela `audit_logs` tem 793 linhas; 405 delas apontam para registros das jornadas e todas permanecem. Fora de qualquer seleção ficam o catálogo `Diagnóstico de Integridade 2026`, os dois órgãos fictícios, as cinco contas-base, os três eixos e a conta `membro.lacuna@orienta.test`.

Pendência de limpeza: nenhuma exclusão remota está habilitada. Uma coleta já validada, concluída ou em validação não cabe na função atual. Criar outra operação administrativa exige aprovação própria e não foi implementada.
