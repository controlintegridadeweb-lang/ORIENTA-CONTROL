# Arquitetura atual do ORIENTA

Este documento descreve a arquitetura vigente. Auditorias e estados substituídos não permanecem na documentação normativa do pacote corrente; o histórico pertence ao controle de versão.

## Stack

- Next.js 16 com App Router e TypeScript.
- Supabase Auth, PostgreSQL, RLS e Storage.
- Tailwind CSS.
- Vitest e Playwright.

## Organização da aplicação

```text
src/
├── app/                    # Entradas HTTP e composição de páginas do Next.js
├── application/            # Casos de uso que coordenam dois ou mais domínios
├── features/               # Domínios funcionais completos
│   ├── app-shell/          # Shell autenticado e navegação estrutural
│   ├── auth/               # Login, recuperação, MFA e ações de sessão
│   ├── support/            # Canais oficiais de suporte e orientações de uso
│   ├── cycles/             # Ciclos e máquina de estados do diagnóstico
│   ├── evidences/          # Documentos, links e uploads pendentes
│   ├── forms/              # Formulários, versões, respostas e atribuições
│   ├── improvement-management/
│   │   ├── recommendations/
│   │   ├── action-plans/
│   │   └── monitoring/
│   ├── respondent-progress/# Leitura consolidada do progresso do respondente
│   ├── validation/         # Formulário unificado e decisões de validação
│   └── ...
├── infrastructure/         # Supabase, Auth, HTTP, segurança e observabilidade
├── shared/                 # Domínio comum, utilitários e UI sem regra de feature
└── test/                   # Setup e stubs compartilhados de teste
```

Não existem camadas genéricas `src/components`, `src/presentation` ou `src/lib`.
A propriedade do código é explícita: UI genérica fica em `shared/ui`; UI
específica fica na feature correspondente; composição entre domínios fica em
`application` ou em `app`.

## Regra de dependência

```text
app → application + features + infrastructure + shared
application → features + infrastructure + shared
features → shared + infrastructure + outras features em grafo acíclico
infrastructure → shared
shared → shared
```

Regras obrigatórias:

1. `shared` não importa `features`, `application`, `infrastructure` nem `app`.
2. `infrastructure` não importa `features`, `application` nem `app`.
3. Features não importam `app`.
4. Dependências entre features não podem formar ciclos.
5. Qualquer contrato consumido por outra feature é exposto pela API pública
   `index.ts` do domínio; imports profundos de pastas internas são proibidos.
6. Um caso de uso que coordena domínios independentes pertence a `application`.
7. Arquivos `route.ts` apenas autenticam/orquestram o adaptador HTTP e delegam o
   caso de uso; regras extensas não permanecem na rota.

Essas regras são verificadas por `npm run check:architecture`, incluindo
resolução de imports locais, dependências invertidas, ciclos entre features e
módulos TypeScript, imports profundos, coerções duplas e respostas HTTP sem
contrato validado em runtime.

## Contextos funcionais

- **Biblioteca:** eixos fixos, seções, critérios e recomendações-base.
- **Formulários:** rascunhos, versões, vínculos, publicação e respostas.
- **Ciclos:** abertura, prazos, estados, conclusão e encerramento.
- **Validação:** fila unificada, formulário completo, evidências, N/A e decisões
  administrativas.
- **Evidências:** arquivos, links, validação estrutural e associação à resposta.
- **Resultado FAMI:** cálculo transacional na conclusão da validação e snapshot
  oficial congelado.
- **Gestão da melhoria:** recomendações, planos de integridade e compliance e supervisão dentro de um
  único bounded context, evitando dependências circulares artificiais.
- **Progresso do respondente:** leitura consolidada por ano e diagnóstico.
- **Relatórios:** emissões oficiais versionadas e arquivos persistidos.

## Fronteiras técnicas

- Regras transacionais e operações em lote ficam no PostgreSQL por RPC.
- APIs validam identidade, papel e organização antes de usar `service_role`.
- O workbench usa `resolveAuthorizedWorkbenchContext` como fronteira de
  autorização.
- O upload de evidências é um caso de uso de `application`, pois coordena
  workbench, evidências, rate limit, assinatura do Storage e validação estrutural.
- Erros emitidos pelo banco são identificados por códigos de domínio ou SQLSTATE
  por meio de `infrastructure/supabase/database-error.ts`; serviços não espalham
  comparações frágeis de trechos de mensagem.
- Listas e catálogos aplicam filtros, contagens e paginação no banco.
- Operações compostas de formulários, organizações e vínculos usam RPCs
  transacionais.
- Integrações com Supabase Auth usam compensação explícita e verificam `error`.

## Scripts operacionais

```text
scripts/
├── bootstrap/       # Primeiro acesso e catálogos oficiais
├── database/        # Migrations, tipos, verificações e migração de projeto
├── imports/         # Cargas institucionais e históricas
├── quality/         # Guardrails estáticos
├── security/        # Procedimentos operacionais privilegiados e auditados
├── shared/          # Infraestrutura comum dos scripts
└── testing/         # Preparação dos testes integrados
```

Dados históricos não fazem parte do pacote. Durante uma importação controlada,
o manifesto é copiado temporariamente para `var/imports/`, ignorado pelo Git.

## Inventário verificável em 4 de setembro de 2026

- **57 páginas** do App Router.
- **110 rotas de API**.
- Vitest | **340 arquivos** em `src/`.
- **4 testes Node.js** de scripts, executados fora do Vitest.
- **1 jornada Playwright canônica**.

Os números devem ser atualizados quando a árvore mudar.

## Fontes oficiais

- Fluxo operacional: [`FLUXO_OPERACIONAL.md`](./FLUXO_OPERACIONAL.md)
- Banco e migrations: [`BANCO.md`](./BANCO.md)
- Automações: [`AUTOMACOES.md`](./AUTOMACOES.md)
- Segurança: [`SEGURANCA.md`](./SEGURANCA.md)
- Deploy: [`DEPLOY.md`](./DEPLOY.md)
