# Deploy na Vercel

Guia para publicar a Plataforma ORIENTA na Vercel a partir deste repositório.

## Pré-requisitos

1. Conta na [Vercel](https://vercel.com) com acesso ao GitHub
   `controlintegridadeweb-lang/orienta-cge-2026`.
2. Projeto Supabase **remoto** (não o local) com:
   - migrations aplicadas (`supabase/migrations/`);
   - buckets privados `evidencias` e `relatorios`;
   - Auth configurado com e-mail/senha e cadastro público desabilitado.
     No painel do Supabase, confirme que **Allow new users to sign up** está desligado
     antes da homologação ou produção.
3. Chaves do Supabase (Dashboard → Project Settings → API):
   - Project URL;
   - `anon` `public`;
   - `service_role` (só servidor).

## 1. Importar o projeto

1. Em [vercel.com/new](https://vercel.com/new), importe o repositório
   `controlintegridadeweb-lang/orienta-cge-2026`.
2. Framework: **Next.js** (já definido em `vercel.json`).
3. Root Directory: `.` (raiz do repo).
4. Build Command / Install Command: deixe os de `vercel.json` (`npm ci` e `npm run build:vercel`). Em produção, esse comando valida a configuração antes do build.
5. Região: `gru1` (São Paulo), já configurada.

Não altere o Root Directory nem adicione Output Directory.

## 2. Variáveis de ambiente (Production)

O `.env.local` tem dois blocos. Só o bloco de **runtime** vai para a Vercel.
`NEXT_PUBLIC_APP_URL` local é `http://localhost:3002`; a origem HTTPS de
produção fica em `PRODUCTION_BASE_URL` e é ela que vira `NEXT_PUBLIC_APP_URL`
na Vercel.

```bash
npx vercel link
# preencha PRODUCTION_BASE_URL no .env.local com a origem HTTPS do projeto
npm run check:vercel-env
npx vercel login   # se ainda não estiver autenticado
npm run sync:vercel-env -- --yes
```

`check:vercel-env` recusa localhost, segredos fracos/repetidos, webhook
incompleto e qualquer tentativa de copiar `SUPABASE_ACCESS_TOKEN`,
`SUPABASE_DB_*` ou `E2E_*`.

No projeto Vercel → **Settings → Environment Variables**, o conjunto final é:

| Variável | Obrigatória | Ambientes | Valor |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | Production (+ Preview se for o caso) | URL do projeto Supabase (`https://….supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | Production (+ Preview) | Chave `anon` |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Production (+ Preview) | Chave `service_role` |
| `NEXT_PUBLIC_APP_URL` | Sim (após o 1º deploy) | Production | URL canônica exata (`https://….vercel.app` ou domínio customizado); usada também na proteção CSRF |
| `CRON_SECRET` | Sim | Production | Segredo longo e aleatório (ex.: `openssl rand -hex 32`) |
| `HEALTHCHECK_SECRET` | Sim | Production | Segredo diferente do cron, usado exclusivamente em `/api/health/ready` |
| `NOTIFICATION_WEBHOOK_URL` | Não | Production | Endpoint do serviço externo de e-mail/mensageria |
| `NOTIFICATION_WEBHOOK_SECRET` | Não | Production | Segredo Bearer aceito pelo dispatcher externo |

Não configure em produção:

- `E2E_*`
- `DATABASE_URL` / `SUPABASE_DB_*` / `SUPABASE_ACCESS_TOKEN` (só scripts locais/CI)
- `NEXT_BUILD_CPUS` / `NEXT_STATIC_GENERATION_CONCURRENCY` (opcional; só se precisar limitar memória)

Marque `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` e `HEALTHCHECK_SECRET` como **Sensitive**.

**A Plataforma ORIENTA não realiza varredura antimalware nesta versão.** A segurança
dos uploads utiliza restrição de formatos (PDF, PNG, JPEG, WebP), validação
estrutural, armazenamento privado, autorização, entrega segura e auditoria.
Arquivos rejeitados na validação estrutural não podem ser vinculados nem baixados.

### Ordem recomendada

1. Cadastre as três variáveis Supabase e o `CRON_SECRET` (Production + Preview).
2. Faça o primeiro deploy.
3. Copie a URL gerada (`https://….vercel.app`) para `NEXT_PUBLIC_APP_URL`.
4. Redeploy (Environment Variables novas só entram no próximo build).

Em Preview, a proteção CSRF reconhece as origens fornecidas pela própria Vercel
por `VERCEL_URL`, `VERCEL_BRANCH_URL` e `VERCEL_PROJECT_PRODUCTION_URL`. Não
crie curingas de origem controlados pelo cliente.

### Checklist rápido de cópia

Não copie `NEXT_PUBLIC_APP_URL` do `.env.local` (é localhost). Use
`PRODUCTION_BASE_URL` ou o valor HTTPS gerado pela Vercel:

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
CRON_SECRET=...
HEALTHCHECK_SECRET=...
NEXT_PUBLIC_APP_URL=https://SEU-PROJETO.vercel.app
```

## 3. Supabase Auth (URLs permitidas)

No Supabase → **Authentication → URL Configuration**:

- **Site URL:** o mesmo valor de `NEXT_PUBLIC_APP_URL` (ex.: `https://seu-app.vercel.app`).
- **Redirect URLs:** inclua (obrigatório para “Esqueci minha senha”):
  - `https://SEU-DOMINIO/auth/update-password`
  - `https://SEU-DOMINIO/**` (wildcard recomendado)

Se `https://SEU-DOMINIO/auth/update-password` **não** estiver na allowlist, o
Supabase ignora o `redirectTo` do app e manda o usuário de volta ao **Site URL**
(geralmente a tela de login `/`), em vez da página **Nova senha**.

Após alterar Site URL / Redirect URLs, peça um **novo** e-mail de recuperação
(o link antigo continua apontando para o destino anterior).

## 4. Workers de manutenção

O `vercel.json` mantém workers independentes, todos protegidos por
`CRON_SECRET`:

| Worker | Responsabilidade |
|---|---|
| `/api/maintenance/cycle-jobs` | abertura, conclusão de validações e encerramento programados |
| `/api/maintenance/imports` | importações de organizações e respondentes |
| `/api/maintenance/report-bundles` | geração de pacotes ZIP de relatórios |
| `/api/maintenance/notifications/enqueue` | criação de lembretes operacionais |
| `/api/maintenance/notifications/dispatch` | entrega da outbox externa |
| `/api/maintenance/pending-evidence-cleanup` | limpeza de uploads temporários vencidos e filas de storage |

A Vercel chama as rotas por `GET` e envia `Authorization: Bearer <CRON_SECRET>`.
Sem `CRON_SECRET`, as rotas respondem 503. Elas também aceitam `POST` para um
agendador externo autenticado.

Sem `NOTIFICATION_WEBHOOK_URL`, os avisos internos permanecem disponíveis no
sino da aplicação e a fila externa é cancelada com motivo explícito.

## 5. Checklist pós-deploy

- [ ] Home de login abre em `/`
- [ ] Login admin → MFA → `/admin`
- [ ] Login respondente → `/respondente`
- [ ] Requisição `POST` com `Origin` externo recebe 403
- [ ] Tentativas repetidas de login recebem 429 sem consultar novamente as credenciais
- [ ] Upload de evidência funciona (Storage + RLS + validação estrutural)
- [ ] Arquivo com formato inválido é rejeitado e removido do upload temporário
- [ ] Arquivo validado é liberado para download via URL assinada
- [ ] Recuperação de senha envia e-mail com link do domínio correto e aplica limite por conta/rede
- [ ] Recuperação do MFA só é possível pelo procedimento [`MFA_RECOVERY.md`](./MFA_RECOVERY.md)
- [ ] Logs da Vercel sem erro de env ausente
- [ ] Todos os workers aparecem em Vercel → Settings → Cron Jobs
- [ ] Sino de notificações exibe os avisos internos
- [ ] Dispatcher externo, quando usado, recebe uma mensagem de teste

## 6. Domínio customizado (opcional)

1. Vercel → Project → Settings → Domains → adicione o domínio.
2. Atualize `NEXT_PUBLIC_APP_URL` e as URLs do Supabase Auth.
3. Redeploy.

## 7. Deploy pela CLI (alternativa)

```bash
npx vercel login
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
npx vercel env add CRON_SECRET production
npx vercel env add HEALTHCHECK_SECRET production
npx vercel --prod
```

Depois do primeiro deploy, adicione `NEXT_PUBLIC_APP_URL` com a URL gerada e
faça `npx vercel --prod` novamente.

Prefira o fluxo GitHub → Vercel para produção contínua a cada push em `main`.

## Troubleshooting

| Sintoma | Causa comum |
|---|---|
| Build falha no typecheck | Código quebrado; rode `npm run typecheck` localmente |
| Runtime: “Missing env …” | Variável não cadastrada ou só em Preview |
| Auth redirect para localhost | `NEXT_PUBLIC_APP_URL` / Site URL do Supabase errados |
| 401 no cron | `CRON_SECRET` ausente ou diferente do esperado |
| Upload de evidência falha | Bucket/RLS não aplicados ou validação estrutural rejeitou o arquivo; confira logs e `file_validation_status` |

Bootstrap do primeiro admin e diagnóstico: veja [`PRIMEIRO_ACESSO.md`](./PRIMEIRO_ACESSO.md).

## 8. Endurecimento obrigatório do Supabase remoto

Além das URLs e chaves, reproduza no Dashboard remoto as garantias presentes no
ambiente local:

- **Authentication → Multi-Factor:** habilite TOTP;
- **Authentication → Password Security:** mínimo de 12 caracteres, maiúscula,
  minúscula, número e símbolo; habilite proteção de senha comprometida quando
  disponível;
- **Authentication → Sessions:** duração máxima de 12 horas e expiração após
  duas horas de inatividade;
- **Authentication → Rate Limits:** sign-in e verificações iguais ou mais
  restritivos que `supabase/config.toml`; recuperação por e-mail com intervalo
  mínimo de 60 segundos;
- **Database → Network Restrictions:** remova `0.0.0.0/0` e `::/0` para conexões
  diretas; permita somente IPs de operação/CI necessários;
- **Database → SSL Enforcement:** exija SSL em toda conexão direta;
- confirme que `responses` e `action_plans` aparecem na publicação Realtime após
  a aplicação das migrations.

A Vercel não precisa de acesso direto à porta PostgreSQL no runtime normal. Ela
usa Supabase Auth, REST/RPC, Realtime e Storage por HTTPS/WSS.

## 9. Checklist de segurança e sincronização

```bash
npm run check:security-sync
npm run db:audit:migrations
npm run typecheck
npm test
npm run build

supabase db reset --local
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run db:verify
```

No piloto, abra a mesma resposta e a mesma ação em duas abas. Salve na primeira
e tente salvar na segunda: a segunda deve receber conflito 409 e solicitar
recarregamento, sem sobrescrever o valor mais recente.


## 10. Gate automatizado de release

O workflow manual **Release readiness** executa o gate estático com as variáveis do ambiente e, depois, o smoke test da URL implantada.

- `/api/health/live`: liveness pública;
- `/api/health/ready`: readiness autenticada, com configuração, banco, Auth, Storage e infraestrutura de upload.

Consulte [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md).
