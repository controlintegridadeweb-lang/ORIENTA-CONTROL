# ADR-0006 — Relatórios versionados

- **Status:** aceito
- **Data:** 2026-07-27

## Contexto
Relatórios oficiais devem continuar reproduzíveis mesmo após reabertura ou evolução do plano de integridade e compliance.

## Decisão
Emitir relatório oficial somente após o encerramento. Reservar a emissão, persistir o PDF no bucket privado, calcular hashes e finalizar o registro apenas após confirmação do arquivo. Cada reemissão cria nova versão vinculada ao ciclo e processamento.

## Alternativas consideradas
- Registrar o relatório antes do upload: descartado porque criaria registros oficiais sem arquivo.
- Sobrescrever o mesmo PDF: descartado porque destruiria a rastreabilidade histórica.

## Regra preservada
Relatório oficial só existe após encerramento e persistência confirmada do PDF, vinculado ao ciclo e ao processamento imutável correspondente.

## Consequências
Nenhum relatório concluído existe sem arquivo persistido. Histórico usa snapshots e downloads por URL assinada temporária.
