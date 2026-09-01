# Vocabulário da interface

Este documento é a única referência para termos visíveis em telas, mensagens, relatórios e exportações do ORIENTA. Nomes técnicos do código, das rotas e do banco podem permanecer diferentes quando forem contratos internos, mas não devem aparecer para quem utiliza a plataforma.

A referência de implementação fica em `src/shared/labels/official-labels.ts`. Para estados do diagnóstico, use `src/shared/domain/cycle-labels.ts`. Para estados de publicação do formulário, use `src/features/forms/form-publication-labels.ts`.

| Termo visível | Significado na plataforma | Não usar como sinônimo na interface |
| --- | --- | --- |
| **Formulário** | Modelo reutilizável, composto por perguntas e configurações. | Diagnóstico, ciclo. |
| **Diagnóstico** | Aplicação de um formulário para uma organização, em um período específico. É a unidade respondida, validada, acompanhada e concluída. | Ciclo, formulário em andamento. |
| **Período** | Escopo compartilhado de uma campanha (`form_periods`), identificado por `period_id` / `period_code` (ex.: `2026.1`). Um período agrupa um ciclo por órgão. | `period_label` (texto livre legado; só apresentação). |
| **Pergunta** | Item que a organização lê e responde dentro de um diagnóstico. | Critério. |
| **Configuração da pergunta** | Seção da biblioteca, tipo de resposta e recomendação-base relacionados à pergunta. | Vínculo. |
| **Organização** | Instituição participante do diagnóstico. | Órgão. |
| **Administrador global** | Único perfil administrativo da plataforma, com acesso a todas as organizações para configurar e acompanhar diagnósticos. | Administrador da organização. |
| **Evidência** | Arquivo, link ou descrição enviada para sustentar uma resposta. | Documento comprobatório, anexo obrigatório, complementação. |
| **Ajuste preparado** | Estado administrativo de uma evidência marcada para correção, antes do envio da devolutiva consolidada. | Ajuste já enviado, pendência do respondente. |
| **Ajuste solicitado** | Devolutiva já enviada ao respondente, que pede uma nova versão da evidência. | Complementação, pendência de complementação. |
| **Aguardando envio do diagnóstico** | Evidência anexada durante o preenchimento, mas o diagnóstico ainda não foi enviado para validação. | Aguardando validação. |
| **Aguardando validação** | Evidência enviada e disponível para decisão administrativa. | Aguardando envio, em análise genérica. |
| **Não exigida** | A pergunta não exige evidência. Não entra em fila nem em pendências de validação. | Aguardando validação. |
| **Não se aplica neste diagnóstico** | Resposta escolhida pelo respondente para uma única pergunta na execução atual. Fica fora do cálculo FAMI apenas desse diagnóstico. | Não aplicável a esta organização, dispensa. |
| **Pergunta não aplicável a esta organização** | Regra administrativa de aplicabilidade, definida pela equipe e válida para a organização em todos os formulários que reutilizarem a pergunta. Fica fora do cálculo FAMI nos diagnósticos abrangidos. | Não se aplica neste diagnóstico, dispensa, isenção. |
| **Aplicabilidade por organização** | Área administrativa que define a regra permanente de aplicabilidade da pergunta. | Não aplicabilidade sem escopo. |
| **Recomendação** | Orientação oficial materializada quando o diagnóstico é consolidado, a partir de resposta negativa ou evidência exigida não aprovada. | Ação, plano de integridade e compliance, sinal provisório. |
| **Plano de integridade e compliance** | Visão gerencial da seção formada pelo conjunto de ações vinculadas às recomendações daquela seção. Cada ação mantém sua recomendação e pergunta de origem para rastreabilidade. | Recomendação isolada, ação isolada. |
| **Origem da ação** | Recomendação — e, por consequência, pergunta — que justificou a criação da ação. É rastreabilidade; não é o agrupador principal do plano na apresentação. | Plano de integridade e compliance da seção. |
| **Comprovação da execução** | Arquivo com validação estrutural ou link HTTPS vinculado à revisão atual de uma ação e exigido para o aceite administrativo. | Evidência do diagnóstico. |
| **Exceção institucional** | Solicitação justificada para dispensar uma recomendação quando não houver ação ativa. A aprovação não altera o FAMI. | Cancelamento de ação, não se aplica. |
| **Resultado FAMI** | Resultado oficial calculado na conclusão do diagnóstico: percentual, pontuação e nível de maturidade. Política vigente (v7): “Sim” sem exigência de evidência vale 1,0; “Sim” com evidência aprovada vale 2,0; “Sim” que exige evidência sem aprovação (pendente, ausente ou insuficiente) vale 0, com máximo 2,0. Processamentos históricos congelam a política da época (ex.: peso 1,5 na v5; baseline 1,0 na v6) e não são recalculados. | Pontuação FAMI ou maturidade FAMI como título genérico de tela. |
| **FAMI preliminar quadrimestral** | Indicador gerencial de acompanhamento do plano, calculável durante o quadrimestre e congelado na data de corte (1º, 2º ou 3º). Parte do último FAMI oficial disponível e projeta somente a recuperação do gap dos critérios com recomendação pela média do progresso das ações ativas. Não altera `fami_results`, não substitui o FAMI anual e exceção aprovada não gera pontos. | Resultado FAMI oficial, FAMI anual, recálculo do diagnóstico. |
| **FAMI anual** | Resultado oficial consolidado do diagnóstico, materializado na conclusão da validação em `fami_results`. É a pontuação divulgada anualmente e não é recalculada pelas ações do acompanhamento quadrimestral. | FAMI preliminar, estimativa em andamento. |
| **Painel comparativo** | Leitura analítica entre organizações ou diagnósticos. Não é um Resultado FAMI oficial. | Visão institucional FAMI, resultado global institucional. |
| **Relatório anual** | PDF oficial emitido no encerramento do diagnóstico, com o Resultado FAMI consolidado. Na capa: **Relatório anual [ano]**. | Relatório bimestral, FAMI preliminar. |
| **Relatório bimestral** | Fotografia imutável do plano de integridade e compliance gerada no bimestre. Na capa: **Relatório bimestral de acompanhamento do plano de integridade e compliance**. Não inclui Resultado FAMI. | Relatório anual, FAMI preliminar. |

## Regras de apresentação

- Apresentar o plano de integridade e compliance na hierarquia **Diagnóstico → Eixo → Seção → Plano de integridade e compliance da seção → Ações**.
- Manter a rastreabilidade de cada ação por **Pergunta → Recomendação → Ação**, sem duplicar dados para criar o agrupamento por seção.
- Exibir **pergunta** em toda superfície que descreve algo que o respondente lê e responde.
- Exibir **diagnóstico** em toda superfície que descreve a execução de um formulário por organização e período.
- Exibir **configuração da pergunta** quando a pessoa precisar definir relações da pergunta com a biblioteca ou com a recomendação-base.
- Exibir **Não aprovada** para evidência que não passou na validação. Na fila administrativa, usar **Ajuste preparado** antes da devolutiva; após o envio ao respondente, usar **Ajuste solicitado**.
- Diferenciar sempre **Não se aplica neste diagnóstico** (escolha pontual do respondente) de **Pergunta não aplicável a esta organização** (regra administrativa permanente).
- Não exibir prioridade derivada (`Alta`, `Média` ou `Baixa`) para recomendações. A interface deve informar situação, plano, prazo e progresso.
- Não chamar de **recomendação** nenhum sinal calculado durante o preenchimento ou a validação; a recomendação oficial só existe após a consolidação.
- Exibir estados de negócio, nunca enums internos. Use, por exemplo, `Em validação`, `Aguardando ajuste` e `Diagnóstico concluído`; nunca `in_validation`, `awaiting_adjustment` ou `completed`.
- Manter `question`, `cycle`, `organization`, `formId`, `cycleId`, `questionId` e nomes de tabela apenas como detalhes técnicos internos.
