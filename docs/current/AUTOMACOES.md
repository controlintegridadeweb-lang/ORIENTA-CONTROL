# Operações programadas dos diagnósticos — 17/07/2026

## Objetivo

Reduzir operações administrativas repetitivas sem criar um módulo de campanhas,
sem duplicar participantes e sem introduzir uma segunda máquina de estados.
O diagnóstico (`cycles`) permanece como única fonte de verdade para formulário,
organização, período, prazo e estado.

## Fluxo administrativo

A abertura fica concentrada em **Diagnósticos → Abrir diagnósticos**:

1. selecionar o formulário e o período;
2. usar todas as organizações vinculadas ou escolher organizações específicas;
3. salvar como rascunho, abrir imediatamente ou programar a abertura;
4. configurar, quando necessário, lembretes, “Conclusão automática, se a validação estiver pronta” e encerramento programado;
5. revisar e confirmar.

Uma única organização e várias organizações usam o mesmo fluxo. Não existem
modos concorrentes de criação individual, lote e campanha na interface.

## Infraestrutura interna

Na baseline timestampada atual, a infraestrutura de automações e notificações está consolidada nas migrations canônicas por dependência; documentos vigentes não dependem mais da numeração legada `0001`–`0054`.

A baseline cria a infraestrutura operacional:

- `automation_jobs`, para autoria, agendamento, tentativas e resultado geral;
- `automation_job_items`, que referencia diretamente os diagnósticos afetados;
- `user_notifications`, para avisos internos;
- `notification_outbox`, para integração externa opcional.

A comunicação por perfil completa o fluxo. O respondente recebe avisos de
abertura, início da validação, solicitação de ajuste, conclusão da validação,
encerramento, emissão do relatório oficial e registros da supervisão do plano.
A notificação do relatório não ocorre na reserva: ela é disparada somente na
transição atômica `preparing → completed`, depois de o PDF existir no Storage e
de hashes, tamanho, período e revisão do plano terem sido validados.
Vereditos negativos provisórios não geram uma notificação definitiva antes da
consolidação. O administrador recebe a primeira submissão no detalhe do ciclo,
cada reenvio diretamente na fila de validação, além de mudanças relevantes e
atrasos do plano de integridade e compliance. As regras administrativas consolidadas na baseline atual
concentra os modelos de leitura e as operações administrativas que consomem a infraestrutura.

Não existem tabelas de campanha, participantes de campanha ou políticas
paralelas de inclusão de organizações. As organizações elegíveis continuam
sendo definidas exclusivamente por `form_assignments`.

A rota `/api/admin/cycles/batch` usa a RPC
`process_cycles_batch_with_reference`. Criação ou reutilização do diagnóstico,
período de referência, revisão do cronograma e criação dos jobs pertencem à
mesma transação. Se a programação falhar, nenhuma parte do lote correspondente
é confirmada parcialmente no banco.

## Operações permitidas

- abertura programada de diagnósticos em rascunho;
- lembretes de prazo;
- conclusão de validações que já estejam aptas, usando a mesma fonte de prontidão da conclusão manual;
- encerramento de diagnósticos que já estejam aptos, seguido da primeira emissão oficial pelo mesmo serviço usado no fluxo manual;
- importações e geração de pacotes de relatórios por jobs auditáveis.

Evidências e respostas “Não se aplica” nunca são aprovadas automaticamente.
Falhas permanecem visíveis por diagnóstico e não são transformadas em sucesso
global. Condições de prontidão ainda não satisfeitas não consomem tentativas de
falha técnica: por exemplo, um encerramento programado sem período de referência
institucional permanece pendente e é reavaliado no próximo ciclo do worker.

## Execução

Os workers são protegidos pelo mesmo `CRON_SECRET`, mas executados de forma
independente para impedir que uma fila lenta bloqueie as demais:

```text
/api/maintenance/cycle-jobs
/api/maintenance/imports
/api/maintenance/report-bundles
/api/maintenance/notifications/enqueue
/api/maintenance/notifications/dispatch
/api/maintenance/pending-evidence-cleanup
/api/maintenance/fami-preliminary-close
```

O `vercel.json` define a frequência adequada de cada worker. Não existe rota agregadora legada: cada fila possui execução, falha e repetição independentes.

Importações e pacotes de relatórios são enfileirados pela requisição do usuário
e processados fora dela. O pacote ZIP é escrito em arquivo temporário e enviado
ao Storage por stream, sem manter todos os PDFs e o ZIP simultaneamente em
memória. Jobs são adquiridos atomicamente com `SKIP LOCKED`, possuem chave de
idempotência, retentativas com backoff e encerram itens pendentes quando o
limite de tentativas é atingido.

Linhas de importação armazenam somente os campos operacionais estritamente
necessários. Senhas e links de recuperação não entram em `input` ou `output`;
constraints do banco rejeitam essas chaves. Após a conclusão, os payloads são
reduzidos e jobs antigos são removidos pela rotina de retenção.

## Integridade temporal e concorrência

Cada diagnóstico possui `schedule_revision`. Alterar datas, reabrir ou registrar
uma nova programação incrementa essa revisão e invalida os itens anteriores.
A abertura, a conclusão da validação, o encerramento e o enfileiramento de
lembretes conferem a revisão dentro da mesma transação que executa a operação.
Assim, um worker que tenha obtido um job antigo não consegue aplicar um
cronograma obsoleto.

Jobs de conclusão da validação e encerramento funcionam como verificações
condicionais persistentes. A opção é exibida como “Conclusão automática, se a validação estiver pronta”. Enquanto o diagnóstico ainda não estiver apto, os jobs são reagendados diariamente sem consumir definitivamente o limite de tentativas.

Quando um job encerra a avaliação, ele usa o mesmo serviço da ação manual para iniciar a primeira emissão oficial. Como banco e Storage não possuem transação distribuída, uma falha de emissão não desfaz artificialmente o encerramento: ela é registrada, o item do job permanece com falha visível e uma nova execução pode retomar a emissão de um ciclo já `completed`. A reabertura continua bloqueada enquanto o PDF desse encerramento não estiver preservado.

Falhas técnicas continuam usando retentativas limitadas e permanecem visíveis.

## Validação estrutural de uploads

Novos arquivos passam por validação estrutural (formato, assinatura, MIME e
tamanho) antes de serem promovidos de `pending_evidence_uploads` para
`evidences` ou de uploads pendentes de comprovação para `action_plan_documents`.
**A Plataforma ORIENTA não realiza varredura antimalware nesta versão.**

Variável obrigatória:

```text
CRON_SECRET
```

Variáveis opcionais:

```text
NOTIFICATION_WEBHOOK_URL
NOTIFICATION_WEBHOOK_SECRET
```

Sem webhook, as notificações internas continuam disponíveis e as entregas
externas são marcadas como canceladas com motivo explícito, sem registrar envio
fictício nem acumular pendências indefinidamente. Registros externos encerrados
são retidos por 30 dias; notificações internas lidas, por 180 dias. O dashboard
administrativo mostra operações e notificações pendentes, falhas e duração
média recente.

A leitura do sino apenas atualiza lembretes operacionais idempotentes. Abertura,
validação e encerramento programados permanecem exclusivos do worker protegido
por `CRON_SECRET`; consultar notificações nunca transiciona um diagnóstico.

## Homologação obrigatória

1. aplicar as migrations canônicas em banco limpo de homologação;
2. validar RLS e grants;
3. abrir diagnósticos para duas organizações vinculadas;
4. testar abertura imediata e programada;
5. confirmar lembretes, conclusão de validação e encerramento;
6. validar resultado individual dos jobs e notificações;
7. executar a rota de manutenção com `CRON_SECRET`.
