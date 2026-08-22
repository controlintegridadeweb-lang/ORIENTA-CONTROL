# ADR-0007 — Reabertura com novo processamento

- **Status:** aceito
- **Data:** 2026-07-27

## Contexto
Correções posteriores não podem modificar silenciosamente o diagnóstico oficial anterior.

## Decisão
Reabertura exige justificativa, novo prazo, ator identificado e auditoria. O ciclo retorna à resposta em nova revisão; processamentos, snapshots e relatórios anteriores permanecem imutáveis.

## Alternativas consideradas
- Editar o processamento anterior: descartado por apagar o estado oficialmente validado.
- Reabrir sem prazo ou justificativa: descartado por enfraquecer governança e auditoria.

## Regra preservada
Toda reabertura gera nova revisão e novo processamento, sem alterar snapshots, FAMI ou relatórios anteriores.

## Consequências
A nova validação produz outra versão. Jobs antigos são invalidados por revisão e o cronograma é recriado transacionalmente.
