# ADR-0008 — Encerramento após supervisão

- **Status:** aceito
- **Data:** 2026-07-27

## Contexto
Validar o diagnóstico conclui o FAMI, mas o encerramento institucional depende da execução e supervisão das recomendações.

## Decisão
Permitir `validated -> completed` somente quando todas as ações ativas estiverem concluídas, não houver solicitação aberta e cada ação possuir aceite vigente para sua revisão atual.

## Alternativas consideradas
- Encerrar imediatamente após a validação: descartado porque ignoraria o plano de integridade e compliance e sua supervisão.
- Considerar ação apenas cadastrada ou em andamento: descartado porque não comprova execução nem aceite.

## Regra preservada
O encerramento exige ações ativas concluídas, ausência de solicitações abertas e aceite vigente para a revisão atual de cada ação.

## Consequências
O teste E2E deve cumprir o fluxo real. A regra do banco não pode ser flexibilizada para acomodar interface ou teste incorreto.
