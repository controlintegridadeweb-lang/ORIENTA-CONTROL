# Fluxo operacional vigente

## Administrador

1. Mantém a biblioteca de seções, critérios e recomendações-base.
2. Cria e publica o formulário.
3. Vincula organizações ao formulário.
4. Abre diagnósticos imediatamente ou agenda operações diretamente nos diagnósticos.
5. Acompanha respostas e evidências.
6. Analisa toda a fila de evidências e respostas “não se aplica”. Pode aprovar,
   não aprovar ou preparar ajustes em várias evidências durante a mesma rodada.
   Depois de concluir a análise, envia todas as solicitações de ajuste ao
   respondente em uma única devolutiva. Para vereditos negativos, pode usar as
   respostas padrão “Evidência não apresentada” e “Evidência insuficiente”, ou
   registrar uma justificativa específica.
7. Conclui a validação, gerando o processamento, o FAMI e as recomendações. No painel em lote, “Em validação” representa todos os diagnósticos nessa etapa, enquanto “Prontos para concluir” inclui somente os que passaram por todas as pré-condições do banco.
8. Supervisiona cada ação do plano, com comentários, pareceres, pendências,
   encaminhamentos, solicitações de ajuste e aceites vinculados à ação e à sua
   revisão congelada. O aceite exige ao menos uma comprovação válida da revisão
   atual: arquivo aprovado pela varredura de segurança ou link HTTPS. Ao final de
   cada quadrimestre, pode congelar um FAMI preliminar de acompanhamento; esse
   checkpoint usa o progresso histórico das ações e nunca reescreve o FAMI oficial.
9. Analisa solicitações de exceção institucional. Uma exceção só pode ser
   solicitada sem ações ativas; quando aprovada, dispensa o plano daquela
   recomendação sem alterar o FAMI. Solicitações pendentes bloqueiam o encerramento.
10. Encerra o ciclo somente quando todas as ações ativas estiverem concluídas,
   sem solicitações abertas, com aceite válido para a revisão atual e com período
   de referência institucional definido. O encerramento não recalcula nem
   sobrescreve o FAMI e inicia automaticamente a primeira emissão oficial.
11. Acompanha a emissão do relatório. Se o Storage falhar após o encerramento, a
   falha fica auditada e a emissão pode ser retomada em Relatórios; a reabertura
   permanece bloqueada até que o documento oficial do encerramento esteja
   preservado. Reemissões posteriores continuam versionadas e exigem motivo.
12. Só reabre a validação enquanto não existir histórico de plano, supervisão ou
    exceção no processamento oficial, evitando recomendações e ações órfãs. A
    reabertura de um ciclo já encerrado também exige relatório oficial preservado.

## Respondente

1. Acessa somente os diagnósticos da própria organização e vinculados ao formulário.
2. Preenche os critérios e envia evidências quando exigidas.
3. Quando recebe uma devolutiva, altera somente as evidências das perguntas indicadas. As respostas e os demais itens permanecem bloqueados. A evidência devolvida é preservada no histórico; a nova versão é enviada em um único reenvio após todas as pendências serem resolvidas.
4. Consulta o Resultado FAMI após a validação.
5. Analisa recomendações e cadastra uma ou mais ações a partir de cada recomendação. Na apresentação gerencial, essas ações passam a compor automaticamente o Plano de ação da respectiva seção.
6. Atualiza execução, prazos, percentual de progresso (0–100%) e comprovações
   do plano. A situação da ação deriva do percentual (0% não iniciada, 1–99%
   em andamento, 100% concluída); cancelamento é excepcional. Cada ação
   possui um respondente real da organização como responsável pelos lembretes.
   Arquivos são enviados diretamente por URL assinada, validados estruturalmente
   e consumidos por RPC atômica antes de ficarem disponíveis. Uma
   alteração material gera nova revisão e invalida o aceite anterior; ação e
   comprovações já aprovadas são imutáveis na revisão aceita.
7. Quando houver impedimento formal e nenhuma ação ativa, pode solicitar uma
   exceção institucional com justificativa e prazo opcional.
8. Responde às solicitações de ajuste informando o que foi corrigido; a
   supervisão confirma a resolução ou mantém a pendência aberta.
9. Consulta o histórico completo de supervisão e os relatórios disponíveis.

## Ordem canônica

Formulário → Diagnóstico → Respostas e evidências → Validação → Resultado FAMI → Recomendações → Planos de ação por seção ou exceção → Supervisão e aceite → Encerramento + primeira emissão automática → Relatório oficial.

Não existem módulos independentes de Campanhas ou Automações na interface. Operações programadas são vinculadas diretamente aos diagnósticos.


## Encadeamento gerencial do plano de ação

A leitura oficial das telas gerenciais, PDF e Excel segue:

**Diagnóstico → Eixo → Seção → Plano de ação da seção → Ações.**

A persistência não cria um novo registro de plano por seção. Cada ação continua vinculada à recomendação que a originou, preservando a cadeia de auditoria:

**Pergunta → Resposta/validação → Recomendação → Ação → Comprovação → Supervisão.**

O Plano de ação da seção é um *read model* derivado das ações das recomendações daquela seção. Totais, progresso e situação do plano da seção e do eixo são agregações calculadas, não campos duplicados. O acompanhamento do plano não recalcula o FAMI oficial.
