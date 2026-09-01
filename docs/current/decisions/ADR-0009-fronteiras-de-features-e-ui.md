# ADR-0009 — Fronteiras de features e propriedade da UI

- **Status:** aceito
- **Data:** 2026-08-01

## Contexto
A árvore possuía camadas genéricas de `components` e `presentation`, imports
profundos entre features e ciclos arquiteturais entre validação, formulários,
recomendações, planos de integridade e compliance e monitoramento. Isso permitia que um componente
ou serviço mudasse por motivos pertencentes a vários domínios.

## Decisão
Remover as camadas genéricas `src/components` e `src/presentation`. UI genérica
fica em `shared/ui`; UI de domínio fica na própria feature; componentes
consumidos por outra feature são expostos por `ui.ts`. Dependências entre
features devem formar um grafo acíclico. Casos de uso que coordenam domínios
independentes ficam em `application`.

Recomendações, planos de integridade e compliance e monitoramento formam o bounded context
`improvement-management`. A validação possui contexto próprio. O progresso do
respondente possui um read model separado.

## Alternativas consideradas
- Manter `components` e `presentation` com regras informais: descartado porque a
  ausência de propriedade explícita recriava acoplamento.
- Proibir toda dependência entre features: descartado porque geraria duplicação
  e abstrações artificiais; dependências direcionais e públicas são permitidas.
- Criar barrels globais únicos: descartado porque misturaria módulos client,
  server e contratos, prejudicando as fronteiras do Next.js.

## Regra preservada
A reorganização não altera workflow, FAMI, autorização, respostas, evidências,
validações, recomendações, planos, supervisão ou relatórios. Ela altera apenas a
propriedade e a direção das dependências do código.

## Consequências
`check:architecture` bloqueia imports locais quebrados, dependências invertidas,
ciclos entre features, camadas obsoletas e importação direta de componentes
internos de outro domínio. Novas composições entre domínios devem ser criadas em
`application` ou na entrada `app`.
