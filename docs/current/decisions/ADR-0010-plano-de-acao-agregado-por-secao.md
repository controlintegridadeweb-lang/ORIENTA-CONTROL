# ADR-0010 — Plano de ação agregado por seção

## Status

Aceito — 2026-08-21.

## Contexto

As ações são criadas a partir de recomendações, e a recomendação é necessária para explicar a origem da intervenção. Entretanto, usar a recomendação como agrupador visual principal fragmenta a leitura gerencial: uma mesma seção pode possuir várias recomendações e, portanto, vários blocos de execução que tratam do mesmo tema institucional.

O ORIENTA precisa permitir a leitura de contribuição em cadeia: ações executam intervenções na seção; as seções compõem um eixo; os eixos compõem o diagnóstico institucional.

## Decisão

A apresentação oficial do plano de ação passa a seguir:

**Diagnóstico → Eixo → Seção → Plano de ação da seção → Ações.**

A cadeia de rastreabilidade permanece:

**Pergunta → Resposta/validação → Recomendação → Ação → Comprovação → Supervisão.**

O Plano de ação da seção é um *read model*. Não será criada tabela, coluna de progresso da seção nem registro duplicado de plano somente para suportar essa apresentação. Ações continuam persistidas e auditadas no vínculo da recomendação que as originou.

Os indicadores de seção e eixo — quantidade de ações, concluídas, atrasadas e execução média — são calculados a partir das ações atuais. Relatórios PDF e exportações devem usar a mesma hierarquia.

## Consequências

- uma seção pode reunir ações de várias recomendações sem perder a origem de cada ação;
- alterações na ação aparecem automaticamente no consolidado da seção;
- não existem sincronizações manuais de `section.progress`, `axis.progress` ou equivalentes;
- a supervisão continua vinculada à ação e à revisão atual;
- o FAMI oficial permanece independente da execução do plano, conforme ADR-0003;
- workspaces específicos de recomendação permanecem como superfícies operacionais para edição e auditoria, enquanto a seção é o agrupador gerencial principal.

## Alternativas consideradas

1. **Criar uma entidade persistida `section_action_plans`.** Rejeitada porque duplicaria o agrupamento já derivável de seção, recomendação e ação e exigiria sincronização transacional adicional.
2. **Manter a recomendação como agrupador visual principal.** Rejeitada porque fragmenta a leitura gerencial de uma mesma seção e dificulta a consolidação por eixo.
3. **Persistir progresso da seção e do eixo.** Rejeitada porque cria estado derivado sujeito a divergência; progresso deve ser calculado a partir das ações.

## Regra preservada

A recomendação continua sendo a origem auditável da ação e todas as regras de revisão, comprovação, supervisão, aceite e encerramento permanecem vinculadas às ações existentes. O FAMI oficial não é recalculado pela execução do plano de ação, conforme ADR-0003.
