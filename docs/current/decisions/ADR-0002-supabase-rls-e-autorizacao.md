# ADR-0002 — Supabase, RLS e autorização

- **Status:** aceito
- **Data:** 2026-07-27

## Contexto
Administrador e respondente possuem escopos distintos e a interface não é fronteira de segurança.

## Decisão
Aplicar RLS em todas as tabelas expostas, grants mínimos, policies explícitas e validação de papel e organização no backend. RPCs `SECURITY DEFINER` revogam `EXECUTE` de `PUBLIC` e recebem apenas os grants necessários.

## Alternativas consideradas
- Autorizar somente na interface: descartado porque chamadas diretas à API continuariam possíveis.
- Usar `service_role` em todas as operações: descartado porque eliminaria a defesa em profundidade da RLS.

## Regra preservada
Papel, organização e identidade do ator são validados no backend e no banco; nenhum identificador fornecido pelo cliente concede acesso por si só.

## Consequências
Toda nova tabela deve nascer sem exposição automática e com decisão explícita de RLS/policies. IDs enviados pelo cliente nunca substituem a identidade obtida da sessão.
