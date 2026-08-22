# Primeiro acesso — fluxo real (admin, respondente, organizações)

> Documento de homologação. Descreve **como o sistema realmente funciona hoje**,
> não como gostaríamos que funcionasse. Tudo aqui foi verificado direto no código
> (`src/features/auth/server-actions.ts`, `src/app/admin/usuarios/`, `src/features/admin/users-service.ts`,
> `supabase/migrations/20260812000200_schema.sql`, `supabase/migrations/20260812000500_functions.sql`
> e os seeds de desenvolvimento em `supabase/seeds/`).

## Resumo do fluxo (atualizado)

O bootstrap inicial (primeiro admin) continua sendo operacional — por segurança,
criação de admin não é exposta na web. A partir daí, **a administração é toda
pela interface**:

- **Primeiro admin**: criado pelo script seguro `npm run bootstrap:admin`
  (idempotente; ver seção 2). Não há tela nem rota web para isso — um endpoint de
  criação de admin seria superfície de ataque permanente.
- **Organizações**: criadas na tela **`/admin/organizacoes`** (ou em massa via
  `npm run import:organizations`). Antes não havia tela; agora há.
- **Formulários/diagnósticos**: criados, revisados e publicados pela interface administrativa. Não existe bootstrap de dados de diagnóstico no runtime de produção; o fixture em `supabase/testing/fixtures/` é exclusivo de testes.
- **Respondentes**: criados na tela **`/admin/usuarios`** ou, para a carga inicial
  em massa, pelo seed administrativo `npm run bootstrap:respondents`. Ambos criam
  a conta Auth e o profile vinculado à organização usando os mesmos contratos.
- **Vínculo usuário↔organização**: definido na criação e editável em
  `/admin/usuarios`.

As seções abaixo descrevem tanto o caminho pela interface quanto o caminho SQL
equivalente (útil para automação/seed).

> Observação de segurança: `organizations` e `profiles` têm RLS sem policy de
> INSERT — por isso toda criação passa por service role no servidor, após
> `requireRole(["admin"])`. Ver `docs/current/SEGURANCA.md`.

## Modelo de dados relevante

`public.profiles` (baseline canônica em `20260812000200_schema.sql`):

| Coluna | Regra |
|---|---|
| `user_id` | PK, FK para `auth.users(id)` (`on delete cascade`). |
| `role` | enum `app_user_role` = `'admin'` ou `'respondent'`. |
| `organization_id` | FK para `organizations(id)`. |
| `full_name` | opcional. |

Constraint crítica — `profiles_role_org_consistency`:

```
check (
  (role = 'admin' and organization_id is null)
  or (role = 'respondent' and organization_id is not null)
)
```

Ou seja: existe **um único administrador global**, sempre com `organization_id` nulo;
respondente é obrigado a ter uma organização vinculada. Um respondente sem organização
viola o banco e não consegue logar.

O gatilho `prevent_profile_identity_change` bloqueia mudanças diretas de `role` e
`organization_id`. A alteração de respondente pela interface ocorre exclusivamente
pela RPC `update_respondent_profile`, que confere o administrador global ator.
`user_id` nunca pode mudar.

## Pré-requisitos

- Schema aplicado (`supabase db reset` aplica `migrations/` e os seeds locais configurados para desenvolvimento).
- Variáveis em `.env.local` (ver `README.md`), incluindo
  `SUPABASE_SERVICE_ROLE_KEY` — necessária para os passos administrativos.
- Em Supabase local, `config.toml` mantém `[auth].enable_signup = false` (sem
  cadastro público) e `[auth.email].enable_signup = true` (provider de e-mail
  ativo para login). A criação de usuários ocorre exclusivamente pelos fluxos
  administrativos com `service_role`, que também garantem o `profiles`
  correspondente — evita contas órfãs no Auth.

---

## 1. Como cadastrar organizações

**Pela interface (recomendado):** acesse **`/admin/organizacoes`**, informe o
nome e clique em *Cadastrar*. O nome é único; nomes duplicados são recusados. A
lista mostra contagem de usuários e respondentes por organização.

**Em massa (CSV):**

```bash
npm run import:organizations -- --file orgaos.csv
```

O CSV deve ter **nome e sigla** em cada linha (cabeçalho `nome,sigla` opcional):

```csv
nome,sigla
Secretaria de Estado da Administração,SEAD
```

A importação faz upsert por nome e atualiza a sigla da mesma fonte, sem duplicar.

**Via SQL** (seed/automação):

```sql
insert into public.organizations (name, acronym)
values ('Organizacao Dev Local', 'ORG-DEV')
on conflict (name) do nothing;
```

**Cadastro de uma organização real** (Supabase SQL editor / `psql`):

```sql
insert into public.organizations (name, acronym)
values ('Prefeitura Municipal de Exemplo', 'PME')
returning id;   -- guarde este id: ele vincula respondentes e waivers
```

> `name` é `unique`. O `id` retornado é o que será usado em `profiles.organization_id`.

---

## 2. Como criar o primeiro admin

Use o script seguro de bootstrap (idempotente). Ele lê
`NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` de `.env.local`:

```bash
npm run bootstrap:admin -- --email admin@orgao.gov.br --password 'SenhaForte123!' --name "Nome do Admin"
```

Comportamento:
- Recusa criar ou promover um segundo administrador; a plataforma opera com uma única conta administrativa global.
- Se já existe conta de Auth com o e-mail, apenas **promove** o profile para
  `admin` (sem organização).
- Senão, cria a conta de Auth (e-mail já confirmado) e o profile de admin.
- Se o insert do profile falhar, **remove** a conta de Auth recém-criada
  (sem usuário órfão).

Depois, acesse `/` e entre com o e-mail e a senha. Como admin global
(`organization_id` nulo), você é levado a `/admin`.

> Alternativa manual (Dashboard + SQL) continua válida e está descrita no
> apêndice, mas o script é o caminho recomendado.

> A tela de login solicita apenas e-mail e senha. O escopo é determinado pelo
> perfil autenticado: o administrador permanece global e o respondente recebe a
> organização registrada em `profiles.organization_id`.

---

## 3. Como criar e publicar o formulário de diagnóstico

Depois de criar o administrador global, use **`/admin/formularios`** para criar, revisar e publicar o formulário. O schema de produção não contém RPC de bootstrap de dados de diagnóstico.

Para testes automatizados existe `supabase/testing/fixtures/bootstrap_diagnostico_integridade_2026.sql`; esse arquivo é fixture de teste e **não deve ser executado em produção ou homologação como mecanismo de provisionamento**. Para a primeira implantação real de 2026, use o bootstrap canônico documentado em `data/bootstrap-2026/README.md`.

---

## 4. Como criar um respondente

**Pela interface (recomendado):** em **`/admin/usuarios`**, use o cartão *Criar
respondente*: informe e-mail, nome (opcional), selecione a **organização** e,
opcionalmente, uma senha provisória. Quando a senha é informada, ela é reconhecida
como o meio de primeiro acesso. Se o campo ficar em branco, o sistema solicita ao
provedor o envio da definição de senha; quando o envio não pode ser solicitado,
gera um **link alternativo** para envio por canal seguro. A ação cria a conta de
Auth e o profile vinculado em um passo só, com rollback automático se o profile
falhar ou se nenhum meio de acesso puder ser produzido.

Pré-requisito: ter ao menos uma organização cadastrada (seção 1) — respondente
exige organização (constraint do banco).

**Via SQL** (automação), o equivalente manual:

```sql
insert into public.profiles (user_id, role, organization_id, full_name)
values (
  '<UUID-do-auth-user>',
  'respondent',
  '<UUID-da-organizacao>',
  'Nome do Respondente'
);
```

**Passo 3.4 — login do respondente.** Em `/`, ele informa e-mail e senha.
Depois da autenticação, o sistema carrega o perfil e usa
`profiles.organization_id` como fonte única do escopo. Em sucesso, vai para
`/respondente` ou retorna ao deep link interno solicitado antes do login.

---

### 4.1. Como criar respondentes

O arquivo `supabase/seeds/respondent_accounts.csv` contém apenas duas contas e organizações fictícias, suficientes para desenvolvimento local. A relação institucional completa — inclusive a carga operacional de 42 respondentes, quando aplicável — deve permanecer fora do Git. Para homologação ou produção, informe o caminho explicitamente:

```bash
npm run bootstrap:respondents -- --file /caminho-seguro/respondentes.csv --dry-run
```

Depois execute a carga com senhas temporárias únicas usando a mesma fonte:

```bash
npm run bootstrap:respondents -- --file /caminho-seguro/respondentes.csv
```

Quando já existir uma relação local com uma senha forte e diferente para cada
conta, use `--password-mode file` e `--credentials-in`. Os arquivos operacionais
ficam em `var/bootstrap/`, fora do Git. A troca posterior de um e-mail provisório
deve ser feita em `/admin/usuarios`, preservando o mesmo usuário e seu histórico.

As credenciais são gravadas somente em
`var/bootstrap/respondent-credentials.csv`, arquivo ignorado pelo Git e criado
com permissão restrita. O processo é idempotente e não redefine senhas de contas
já existentes. Detalhes, modo de homologação com senha fixa e alertas de
entregabilidade estão em
[`CARGA_RESPONDENTES_SUPABASE.md`](./CARGA_RESPONDENTES_SUPABASE.md).

## 5. Como vincular usuário à organização

Há dois caminhos, dependendo de quem faz e quando.

**5.1 — Na criação (SQL).** O vínculo é a própria coluna `organization_id` em
`profiles`, definida no `insert` do passo 3.3.

**5.2 — Depois, pela interface admin.** Em `/admin/usuarios`, o admin pode editar um
respondente já existente (`saveUserProfileAction` → `updateUserProfileAdmin`):

- altera `full_name` e `organization_id`; o papel de respondente não é editável nessa tela;
- **exige** uma organização selecionada para respondentes
  ("Selecione uma organização para respondentes.");
- **não** edita administradores e **não** promove ninguém a admin por essa tela
  (ambos bloqueados em `users-service.ts`).

Essa edição usa a RPC `update_respondent_profile`, que recebe o ator da sessão e
confere no banco que ele é o administrador global antes de alterar o respondente.

**5.3 — Redefinir senha (admin).** `resetPasswordAction` solicita primeiro o envio
do e-mail de recuperação. Se o provedor rejeitar a solicitação, o sistema gera um
link alternativo (`generateLink type: "recovery"`) e o copia para a área de
transferência. O usuário abre o link e define a senha em
`/auth/update-password`. Disponível apenas para respondentes (reset de admin é
bloqueado na service). A operação não confirma sucesso quando nenhum dos dois
meios pode ser produzido.

> Recuperação por conta própria: qualquer usuário pode usar `/auth/forgot-password`,
> que dispara `resetPasswordForEmail` com retorno para `/auth/update-password`.

---

## 6. Ordem recomendada de bootstrap (do zero à homologação)

1. Aplicar schema: `supabase db reset` (aplica migrations +
   os seeds locais de desenvolvimento, quando aplicável).
2. Criar o **primeiro admin**: `npm run bootstrap:admin -- --email ... --password ...`
   (seção 2).
3. Criar/revisar o formulário em `/admin/formularios` e publicá-lo pelo fluxo administrativo (seção 3).
4. Logar como admin em `/admin` e revisar/publicar o formulário pelo fluxo normal.
5. Cadastrar **organizações** reais em `/admin/organizacoes` (ou
   `npm run import:organizations -- --file orgaos.csv` para uma lista em CSV). O
   seed já traz órgãos do RN para começar.
6. Criar **respondentes** em `/admin/usuarios` ou executar
   `npm run bootstrap:respondents` para a carga institucional em massa.
7. Entregar a cada respondente: e-mail e o link de definição de senha gerado
   (ou a senha provisória). A organização não é escolhida no login; ela vem do perfil.

---

## Apêndice — pontos de atenção conhecidos

- **Build sem rede externa de fontes.** As fontes são empacotadas localmente;
  `npm run build` não depende de `fonts.googleapis.com`.
- **Runtime/SSR com Supabase exigem as variáveis públicas e a service role.**
  Configure `.env.local` no desenvolvimento e o provedor de produção antes de
  testar fluxos autenticados ou operações de banco.
- **Sem signup público** — não há auto-cadastro. Organizações e respondentes são
  criados por um admin pela interface; o primeiro admin, pelo script de bootstrap.
  Se a homologação exigir onboarding self-service, é uma feature nova.


## Administrador único

O bootstrap usa a função `bootstrap_global_admin`, disponível apenas para `service_role`. Ela cria ou confirma o único administrador global, sem organização vinculada. Não altere `role` ou `organization_id` diretamente em perfis pela interface ou por chamadas de cliente.

## Segundo fator do administrador

No primeiro login administrativo, a plataforma redireciona para
`/auth/mfa`. Cadastre o QR Code em um aplicativo autenticador e confirme o código
de seis dígitos. Sem uma sessão `aal2`, páginas e APIs administrativas permanecem
bloqueadas.

Guarde os procedimentos de recuperação do projeto Supabase em local
institucional seguro. A chave manual exibida no cadastro não deve ser enviada
por e-mail, mensagem instantânea ou armazenada no repositório.
