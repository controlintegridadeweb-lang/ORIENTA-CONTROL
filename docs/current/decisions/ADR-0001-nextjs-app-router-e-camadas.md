# ADR-0001 — Next.js App Router e camadas

- **Status:** aceito
- **Data:** 2026-07-27

## Contexto
A plataforma precisa combinar páginas autenticadas, APIs server-side, componentes reutilizáveis e regras de domínio testáveis sem acoplamento ao framework.

## Decisão
Usar Next.js App Router. `src/app` compõe páginas e rotas; `src/features` concentra domínios funcionais; `src/shared/domain` mantém regras puras; `src/application` orquestra casos de uso; `src/infrastructure` contém Supabase, autenticação, segurança e observabilidade.

## Alternativas consideradas
- Pages Router com regras concentradas nas páginas: descartado por ampliar acoplamento e dificultar testes.
- Acesso direto ao Supabase em componentes: descartado por misturar apresentação, autorização e persistência.

## Regra preservada
As regras do ORIENTA permanecem fora da camada de interface e não podem ser duplicadas em páginas ou componentes.

## Consequências
Páginas não acessam tabelas privilegiadas diretamente. Rotas ficam finas e delegam a serviços. Regras de domínio não podem depender de React, Next.js ou service role.
