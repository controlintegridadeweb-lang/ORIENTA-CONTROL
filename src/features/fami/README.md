# FAMI — leitura canônica por ciclo

Este módulo concentra a leitura do diagnóstico de maturidade. O FAMI oficial é
sempre resultado de um `cycle_processing` concluído na finalização da validação
do formulário. O ciclo pode permanecer em `validated` durante a elaboração e o
acompanhamento do plano de ação e, depois, avançar para `completed` sem recalcular
o resultado diagnóstico.

## 1. Contrato de identidade

Toda leitura que represente um diagnóstico concreto recebe uma destas chaves:

- `cycleId`, para consultar o processamento FAMI oficial mais recente ou uma
  versão histórica do mesmo ciclo;
- `cycleProcessingId`, quando o processamento já foi selecionado pelo chamador.

`formId + organizationId + processingVersion` **não** identifica um diagnóstico
com segurança: dois ciclos históricos do mesmo formulário e órgão podem possuir
a mesma versão de processamento. Esse triplo não deve ser usado para leituras,
conferências, relatórios, recomendações ou plano de ação.

## 2. Caminhos oficiais

```text
cycle-fami-read → fami-context → fami-maturity-view
```

- [`cycle-fami-read.ts`](cycle-fami-read.ts) lê snapshots, evolução e anos de
  referência de um ciclo específico;
- [`fami-context.ts`](fami-context.ts) resolve o contexto do ciclo e a versão
  oficial de processamento;
- [`fami-maturity-view.ts`](fami-maturity-view.ts) monta o contrato
  `FamiMaturityView` para uma superfície de diagnóstico.

Não existem APIs de cálculo ou inferência avulsos. O FAMI é materializado
somente por `finalize_validation_cycle`, na conclusão da validação. A conferência
administrativa é somente leitura e compara o resultado persistido com um cálculo
reconstruído exclusivamente pelos snapshots imutáveis do processamento.

## 3. Conclusão do diagnóstico e encerramento da avaliação

O FAMI não é calculado durante o preenchimento. Depois que todas as respostas, as evidências efetivamente anexadas e as
justificativas “não se aplica” forem avaliadas, a operação de
conclusão da validação executa, na mesma transação:

- validação final das pendências;
- geração das recomendações oficiais;
- bloqueio do diagnóstico e leitura do estado vivo no banco;
- cálculo do FAMI com pesos e faixas oficiais dentro da transação;
- congelamento das respostas, evidências, dispensas e política FAMI;
- persistência dos resultados globais, por eixo e por seção;
- conclusão do processamento;
- transição `in_validation → validated`.

A partir de `validated`, o Resultado FAMI já está disponível. O plano de ação é
elaborado e acompanhado depois, sem modificar retroativamente o diagnóstico.
A transição `validated → completed` encerra apenas o ciclo de acompanhamento e
não recalcula nem reescreve o FAMI.

Regras de pontuação (política v7):

- “Sim” em critério que não exige evidência: 1,0 obtido / 1,0 possível;
- “Sim” com evidência obrigatória aprovada: 2,0 / 2,0;
- “Sim” que exige evidência sem aprovação (pendente, ausente, insuficiente ou
  validado sem comprovação): 0 / 2,0 — sem pontuação provisória;
- resposta negativa: 0 / (1,0 ou 2,0 conforme a exigência);
- processamentos históricos v3–v6 preservam a política congelada da época;
- dispensas e respostas “não se aplica” aprovadas não entram no denominador;
- quando nenhum critério é aplicável, o resultado é N/A, nunca 0% de desempenho;
- o percentual é arredondado para duas casas antes da classificação do nível.

## 4. Comparação entre diagnósticos

Listas e filtros podem comparar diagnósticos reais, preservando organização,
formulário, período e processamento. A plataforma não calcula um Resultado FAMI
agregado entre organizações, formulários ou períodos. Nenhuma operação de
escrita ou detalhe de diagnóstico pode inferir um ciclo pelo “mais recente”.

## 5. Onde alterar cada regra

- reconstrução histórica por snapshots: `lib/cycle-commit/collect.ts`;
- espelho matemático puro para conferência: `lib/domain/fami.ts`;
- cálculo oficial e finalização transacional: função
  `calculate_live_fami_rows` e RPC `finalize_validation_cycle`, na baseline
  (`0027_validacao_insuficiente_fila.sql`), chamadas por
  `CycleStateService.consolidateValidation()`;
- leitura por ciclo: `lib/fami/cycle-fami-read.ts`;
- composição da visão: `lib/fami/fami-maturity-view.ts`;
- conferência histórica: rota `POST /api/fami/reconcile` com `cycleId`, somente
  leitura.

## 6. FAMI preliminar quadrimestral

O acompanhamento quadrimestral é um domínio separado do Resultado FAMI oficial.
`fami_results` continua exclusivo do diagnóstico validado. Checkpoints usam as tabelas `fami_preliminary_processings`, `fami_preliminary_action_snapshots`, `fami_preliminary_criterion_results` e `fami_preliminary_results`.

A materialização usa a mesma função de domínio para o cálculo manual do administrador durante o período aberto e para o fechamento automático na data de corte. A prévia considera os dados válidos até o instante da execução; o fechamento reconsolida o snapshot com os dados até o corte. Recálculos no período aberto geram nova versão de auditoria, mas a leitura expõe um resultado vigente por ciclo/ano/quadrimestre. Depois do fechamento o snapshot é imutável.

O FAMI anual permanece em `fami_results` e aparece em bloco próprio. A tabela quadrimestral mostra só o FAMI preliminar, a evolução e a ação. A exportação quadrimestral é própria, marcada como não oficial e não é incorporada ao PDF oficial do diagnóstico.
