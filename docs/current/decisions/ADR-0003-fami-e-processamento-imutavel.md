# ADR-0003 — FAMI e processamento imutável

- **Status:** aceito
- **Data:** 2026-07-27
- **Atualização:** 2026-08-07 (política v7 — sem ponto provisório em evidência)

## Contexto
O resultado precisa representar o diagnóstico validado e permanecer auditável após planos, encerramento ou reabertura.

## Decisão
Calcular e congelar o FAMI na conclusão da validação. Cada consolidação gera processamento e snapshots imutáveis.

Pesos oficiais (política v7):
- Sim sem exigência de evidência: 1,0 obtido / 1,0 possível;
- Sim com evidência aprovada: 2,0 / 2,0;
- Sim que exige evidência sem aprovação (pendente, ausente, insuficiente ou validado sem comprovação): 0 / 2,0;
- Não: 0 / (1,0 ou 2,0 conforme a exigência);
- Não se aplica / não aplicável: excluído.

Processamentos históricos com `fami_policy_version` v3–v6 permanecem congelados (incl. baseline 1,0 da v5/v6 e peso 1,5 da v3–v5); novas finalizações usam `v7`.

## Alternativas consideradas
- Recalcular o FAMI durante o plano de ação: descartado porque misturaria diagnóstico com execução.
- Usar peso único para todos os critérios: descartado porque contraria a regra institucional consolidada.
- Conceder 1,0 provisório a “Sim” com evidência exigida e ainda não aprovada: descartado — confunde pontuação com pendência de validação.

## Regra preservada
O Resultado FAMI oficial só é materializado ao concluir a validação. Pontuação 0 não encerra pendência administrativa: evidência pendente e decisão administrativa pendente continuam bloqueando a finalização no backend.

## Consequências
Plano de ação e encerramento não recalculam FAMI. Reabertura cria nova versão de processamento sem sobrescrever resultados anteriores. Correção de históricos exige operação administrativa explícita e auditável.

## Extensão — acompanhamento preliminar quadrimestral

O FAMI preliminar usa armazenamento, processamento e histórico próprios (`fami_preliminary_*`). Ele não é uma nova versão de `fami_results` e não modifica snapshots do diagnóstico.

Metodologia `prelim_v1`:
- base = pontuação oficial congelada existente na data de corte do quadrimestre;
- gap recuperável = pontos possíveis − pontos oficiais do critério;
- somente critérios com recomendação do mesmo processamento podem recuperar gap;
- recuperação = gap × média do percentual das ações ativas no corte;
- ações canceladas ficam fora da média; sem ação ativa = 0% de recuperação;
- exceção institucional aprovada = 0% de recuperação;
- aceite/supervisão permanece informação de governança e não cria pontos automaticamente;
- 1º quadrimestre: 01/01–30/04; 2º: 01/05–31/08; 3º: 01/09–31/12;
- cada novo cálculo cria `calculation_version` adicional e preserva versões anteriores.

O Resultado FAMI oficial continua sendo produzido exclusivamente pela validação do diagnóstico. Quando o diagnóstico de referência é anual, ele permanece o resultado anual oficial; os checkpoints quadrimestrais são apenas acompanhamento entre avaliações oficiais.
