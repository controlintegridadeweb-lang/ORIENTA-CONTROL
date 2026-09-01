-- ORIENTA greenfield baseline — Comentários de catálogo finais
-- Gerada a partir do estado final pré-cutover; não contém dados históricos reais.

comment on constraint profiles_role_org_consistency on public.profiles is
  'Administrador único e global sem organização; respondente vinculado obrigatoriamente a uma organização.';
comment on table public.axes is
  'Eixos ESG oficiais. O schema não semeia IDs; após carga, nomes são únicos e apenas os três valores canônicos são aceitos.';
comment on table public.sections is
  'Agrupador de apresentação (vivo). Estado congelado dentro de question_versions (Opção B).';
comment on column public.questions.evidence_parameter is
  'SSOT da exigência de evidência: {"required": bool}. Sem coluna espelho; peso FAMI deriva daqui.';
comment on column public.questions.allows_not_applicable is
  'Autoriza a decisão Não se aplica para o critério; o valor é congelado em question_versions na publicação.';
comment on table public.question_versions is
  'Snapshot imutável do critério, seção/eixo e configuração editorial publicada. Peso FAMI derivado de evidence_parameter.';
comment on column public.forms.current_form_version_id is
  'Única versão atribuível. publication_state é derivado em leitura, nunca coluna.';
comment on table public.form_versions is
  'Snapshot imutável do formulário ao publicar. state = published|superseded|archived.';
comment on table public.form_questions is
  'Liga uma form_version às question_version congeladas. Imutável (pertence a versão imutável).';
comment on column public.cycles.state is
  'Única máquina de estados de negócio (ver lib/domain/workflow.ts). forms não tem estado de fluxo.';
comment on column public.cycles.reopen_count is
  'Reaberturas. FAMI/relatório anteriores preservados; cada encerramento gera nova processing_version.';
comment on column public.cycles.original_response_deadline_at is
  'Prazo de resposta da abertura (ou primeira definição). Prorrogações individuais não o alteram.';
comment on column public.cycles.response_collection_paused_at is
  'Quando preenchido, a coleta está suspensa para este ciclo sem mudar cycles.state.';
comment on column public.cycles.deadline_change_count is
  'Quantidade de alterações/prorrogações administrativas do prazo de resposta.';
comment on function public.prevent_form_assignment_delete_with_cycles() is
  'Impede remover atribuição formulário × organização depois que existe diagnóstico, preservando acesso e histórico.';
comment on table public.cycle_processings is
  'Fonte única da processing_version e da política FAMI ponderada por evidência, congelada por versão.';
comment on column public.cycle_processings.yes_without_evidence_weight is
  'Pontuação da resposta Sim quando o critério não exige evidência: 1,0 ponto.';
comment on column public.cycle_processings.yes_with_approved_evidence_weight is
  'Pontuação da resposta Sim quando o critério exige evidência e ela foi aprovada: 2,0 (v6+) ou 1,5 (histórico v3–v5).';
comment on column public.responses.na_justification is
  'Justificativa obrigatória do respondente ao marcar Não se aplica neste diagnóstico.';
comment on column public.responses.na_validation_status is
  'Veredito admin: pending até a fila; approved mantém N/A; rejected materializa Não e permanece revisável até a consolidação.';
comment on table public.evidences is
  'Evidências de respostas. Uma resposta pode possuir múltiplas evidências ativas, validadas individualmente.';
comment on table public.pending_evidence_uploads is
  'Uploads do Storage ainda não associados a evidência; removidos automaticamente após expires_at.';
comment on table public.evidence_storage_cleanup_queue is
  'Outbox transacional de exclusão de objetos do bucket privado de evidências.';
comment on function public.deactivate_incompatible_evidence_on_response_change() is
  'Desativa evidências ativas ao trocar uma resposta para Não ou Não se aplica.';
comment on function public.deactivate_incompatible_evidence_on_evidence_write() is
  'Impede evidência ativa para resposta diferente de Sim em qualquer canal de escrita.';
comment on function public.replace_question_organization_waivers(
  uuid, uuid[], jsonb, uuid
) is
  'Substitui atomicamente as dispensas de uma pergunta dentro de um escopo de organizações validado pela API.';
comment on column public.recommendations.text is
  'Congelado no processamento. status NÃO é coluna — derivado em leitura (6.7).';
comment on column public.recommendations.source is
  'Quem produziu a recomendação: engine (motor) ou manual (ajuste administrativo).';
comment on column public.recommendations.origin is
  'Origem estruturada da recomendação: trigger, mode e generated_at.';
comment on table public.action_plan_progress_updates is
  'Histórico de alterações de percentual/situação das ações do plano.';
comment on table public.pending_action_plan_document_uploads is
  'Uploads diretos temporários de comprovações de execução; só viram documento após verificação e consumo atômico.';
comment on table public.action_plan_storage_cleanup_queue is
  'Outbox transacional de exclusão de objetos do bucket privado planos-acao.';
comment on function public.delete_respondent_action_plan(uuid, uuid, uuid, uuid, bigint) is
  'Exclui uma ação do plano pelo respondente da organização, com auditoria e cobertura de ciclo concluído.';
comment on function app_private.is_cycle_respondent_editable(uuid) is
  'Guarda de defesa: identifica ciclo editável pelo respondente; mutações oficiais passam pelo backend.';
comment on function app_private.is_response_respondent_editable(uuid) is
  'Guarda de defesa: identifica evidência editável pelo ciclo; mutações oficiais passam pelo backend.';
comment on function app_private.is_cycle_question_version_allowed(uuid, uuid) is
  'Integridade: confirma que a versão da pergunta integra o formulário congelado do ciclo.';
comment on policy action_plans_read_scoped on public.action_plans is
  'Leitura escopada para administradores e respondentes; toda mutação ocorre exclusivamente pela RPC transacional do respondente.';
comment on policy action_plan_progress_updates_read_scoped
  on public.action_plan_progress_updates is
  'Leitura do histórico de progresso no mesmo escopo das ações; escrita apenas via RPC.';
comment on function public.match_evidence_adjustment_replacements(uuid) is
  'Associa cada evidência devolvida a uma única evidência pendente posterior da mesma resposta.';
comment on function public.create_cycle is
  'Cria atomicamente ciclo draft + processing v1. Identidade do período: form_periods/period_id (period_label resolve period_code).';
comment on function public.guard_validation_queue_transition() is
  'Impede que in_validation avance para ajuste ou consolidação fora da fila oficial de evidências.';
comment on function public.validate_not_applicable_response(uuid, uuid, text, uuid, text, text, timestamptz) is
  'Registra e permite revisar o parecer N/A enquanto o ciclo está em validação; rejeitar exige motivo e converte a resposta para Não.';
comment on function public.validate_evidence(uuid, uuid, text, uuid, text, text, timestamptz) is
  'Registra o veredito de uma evidência na fila oficial sem encerrar a rodada administrativa.';
comment on function public.create_report_emission(uuid, uuid, text, uuid, timestamptz, text) is
  'Registra emissão imutável somente após confirmar PDF persistido no bucket privado e no caminho do mesmo tenant/ciclo/processamento.';
comment on table public.automation_jobs is
  'Registro auditável de operações em lote e agendadas vinculadas diretamente aos diagnósticos.';
comment on table public.automation_job_items is
  'Itens de um job operacional; entity_type=cycle referencia public.cycles sem duplicar participantes ou estados.';
comment on table public.notification_outbox is
  'Fila de entrega externa. Sem integração configurada, o dispatcher cancela a entrega e preserva o aviso in-app.';
comment on function public.notify_organization_respondents is
  'Enfileira avisos in-app e outbox para respondentes da organização, com deduplicação.';
comment on function public.notify_administrators is
  'Enfileira avisos in-app e outbox para administradores, com deduplicação por usuário.';
comment on function public.notify_cycle_lifecycle() is
  'Notifica abertura, submissão, reenvio, validação e encerramento; encerra validation_pending ao sair de submitted.';
comment on function public.notify_action_plan_change() is
  'Avisa administradores sobre criação, atualização, conclusão ou remoção de ações do plano.';
comment on function public.notify_supervision_note() is
  'Notifica prioritariamente o responsável da ação; sem responsável, avisa os respondentes da organização.';
comment on function public.notify_report_emission() is
  'Avisa respondentes somente após a transição atômica da emissão de preparing para completed; o trigger faz parte da baseline canônica de triggers.';
comment on function public.notify_respondent_user is
  'Enfileira aviso in-app e outbox para um único respondente, com deduplicação.';
comment on function public.notify_respondent_open_cycles is
  'Notifica o respondente sobre diagnósticos já abertos na organização ao vincular o perfil.';
comment on function public.profiles_notify_open_cycles() is
  'Dispara avisos de diagnósticos abertos quando um respondente é vinculado a uma organização.';
comment on function public.list_organization_respondents(uuid) is
  'Lista identidades respondentes do órgão para atribuição de responsabilidade no plano de integridade e compliance.';
comment on function public.discard_pending_evidence_upload(uuid, uuid, uuid, uuid) is
  'Torna um upload temporário não associável e enfileira a exclusão física atomicamente.';
comment on table public.respondent_profile_details is
  'Dados funcionais complementares do respondente. Não mistura matrícula, lotação ou cargo com preferences nem com auth.users.';
comment on column public.respondent_profile_details.source_submitted_at is
  'Data informada pela fonte de importação; não substitui submitted_at do ciclo operacional.';
comment on column public.cycles.schedule_revision is
  'Versão monotônica do cronograma. Jobs com revisão diferente são obsoletos e não podem alterar o diagnóstico.';
comment on column public.cycles.reminder_offsets_days is
  'Antecedências oficiais, em dias, para lembretes do prazo de resposta.';
comment on column public.cycles.validation_deadline_at is
  'Data oficial para tentar concluir automaticamente apenas validações que já estejam prontas e sem pendências.';
comment on column public.cycles.cycle_close_at is
  'Data oficial para verificar automaticamente o encerramento da avaliação.';
comment on column public.cycles.deadline_policy is
  'Política oficial: envio após o prazo é permitido, mas o atraso é registrado e auditado.';
comment on column public.cycles.submitted_late_at is
  'Data do último envio realizado após response_deadline_at; nulo quando o último envio foi pontual.';
comment on column public.cycles.submission_delay_seconds is
  'Atraso, em segundos, do último envio em relação ao prazo de resposta.';
comment on function public.create_or_open_cycle is
  'Cria ou reutiliza um diagnóstico e o abre atomicamente por organização. É idempotente, preserva ciclos já iniciados e retorna status detalhado.';
comment on column public.pending_evidence_uploads.file_validation_status is
  'Upload temporário só pode virar evidência após validação estrutural (assinatura/MIME/tamanho). Não indica varredura antimalware.';
comment on column public.evidences.file_validation_status is
  'Estado da validação estrutural do arquivo. Não indica ausência de malware.';
comment on column public.evidences.file_validated_at is
  'Momento em que a validação estrutural do arquivo foi concluída. Distinto de validated_at (veredito administrativo).';
comment on table public.cycle_validation_reopen_events is
  'Histórico de reaberturas administrativas da validação (validated → in_validation).';
comment on function public.enforce_cycle_transition_integrity() is
  'Guarda das arestas canônicas e das reaberturas oficiais (diagnóstico e validação). '
  'Evidências pendentes em N/A administrativo não impedem in_validation → validated.';
comment on function public.validation_reopen_impact(uuid) is
  'Quantifica histórico posterior à validação que impede reabertura sem perda de vínculo.';
comment on function public.reopen_validation_cycle(uuid, uuid, text) is
  'Reabre validação concluída (validated → in_validation), preserva FAMI/decisões e cria novo processing working.';
comment on function public.deactivate_misplaced_legacy_evidence_link(
  uuid, uuid, text, text
) is
  'Desativa links legados sem critério oficial (órfãos) ou indevidos no ciclo.';
comment on function public.reconcile_legacy_evidence_link(
  uuid, uuid, uuid, text, integer, text, public.evidence_validation_status
) is
  'Garante link legado no critério oficial: copia quando compartilhado, sem remover do critério de origem.';
comment on column public.responses.admin_applicability_status is
  'Decisão administrativa de aplicabilidade: null ou not_applicable.';
comment on column public.responses.admin_na_justification is
  'Justificativa obrigatória quando admin_applicability_status = not_applicable.';
comment on column public.responses.admin_na_decided_by is
  'Administrador que registrou o N/A administrativo.';
comment on column public.responses.admin_na_decided_at is
  'Instante da decisão administrativa de N/A.';
comment on column public.response_snapshots.admin_applicability_status is
  'Status administrativo de aplicabilidade congelado no fechamento.';
comment on column public.response_snapshots.admin_na_justification is
  'Justificativa do N/A administrativo congelada no fechamento.';
comment on table public.response_admin_applicability_events is
  'Histórico auditável de marcações e reversões de N/A administrativo na validação.';
comment on function public.publish_form is
  'Publica atomically uma form_version e materializa question_versions imutáveis para todos os critérios do rascunho.';
comment on function public.publish_form(uuid, uuid) is
  'Publica atomically uma form_version e materializa question_versions imutáveis, incluindo allows_not_applicable.';
comment on function public.mark_response_admin_not_applicable(
  uuid, uuid, uuid, text, text, timestamptz
) is
  'Marca N/A administrativo em resposta Sim/Não elegível durante in_validation, sem alterar resposta ou evidências.';
comment on function public.revert_response_admin_not_applicable(
  uuid, uuid, uuid, text, text, timestamptz
) is
  'Reverte N/A administrativo durante in_validation, restaurando campos admin_* sem alterar a resposta.';
comment on function public.mark_responses_admin_not_applicable_batch(
  uuid, uuid, uuid[], text
) is
  'Marca até 200 respostas como N/A administrativo; falhas por item retornam código explícito.';
comment on column public.responses.admin_proof_observation is
  'Observação obrigatória da decisão administrativa de comprovação.';
comment on column public.responses.admin_proof_decided_by is
  'Administrador que registrou a decisão de comprovação.';
comment on column public.responses.admin_proof_decided_at is
  'Instante da decisão administrativa de comprovação.';
comment on function public.dispatch_evidence_adjustments(uuid, uuid) is
  'Devolve ao respondente ajustes documentais e solicitações de comprovação ausente.';
comment on function public.apply_workbench_response(
  uuid, uuid, uuid, public.answer_value, text, bigint, jsonb
) is
  'Persiste resposta e evidências; em awaiting_adjustment aceita ajuste documental ou comprovação solicitada.';
comment on function public.commit_cycle_transition(uuid, uuid, public.cycle_state, jsonb, jsonb, public.cycle_state) is
  'Transiciona o ciclo; no retorno de awaiting_adjustment exige comprovação solicitada atendida.';
comment on column public.responses.admin_proof_status is
  'Decisão administrativa sem documento: validated_without_proof | proof_requested | considered_insufficient.';
comment on function public.decide_response_without_proof(
  uuid, uuid, uuid, text, text, text, timestamptz
) is
  'Registra decisão sem documento: Sim sem comprovação, ou Não elegível a N/A (aprovar/insuficiente/ajuste).';
comment on function public.calculate_live_fami_rows(uuid) is
  'FAMI v7: sem evidência Sim=1; com evidência aprovada=2; sem aprovação=0 / 2; N/A fora do denominador.';
comment on function public.calculate_live_recommendations(uuid) is
  'Infere recomendações oficiais; insuficiente (com ou sem documento) gera evidencia_insuficiente; N/A exclui.';
comment on function public.get_validation_finalization_readiness(uuid) is
  'Fonte única das condições que permitem concluir a validação; comprovação ausente só bloqueia sem documento ativo.';
comment on function public.list_validation_finalization_readiness(uuid[]) is
  'Retorna, em uma consulta, quais diagnósticos visíveis estão realmente prontos para concluir a validação.';
comment on function public.get_validation_queue_summary(uuid) is
  'Resumo da fila com decisões de comprovação ausente e catálogo formSections.';
comment on function public.list_validation_queue_page(uuid, text, uuid, integer, integer) is
  'Página da fila; ordena Sim sem comprovação pendente junto dos demais pendentes.';
comment on function public.finalize_validation_cycle(uuid, uuid) is
  'Finaliza a validação (FAMI v7); congela title/text_body nos evidence_snapshots. Históricos v3–v6 imutáveis.';
comment on function public.find_validation_queue_page_for_evidence(
  uuid, uuid, uuid, integer
) is
  'Localiza a página da fila de evidências com o mesmo ranking de list_validation_queue_page (admin_proof incluso).';
comment on table public.cycle_deadline_events is
  'Linha do tempo imutável de alterações administrativas de prazo/coleta.';
comment on table public.cycle_reopen_allowed_questions is
  'Critérios liberados em reabertura parcial. Sem linhas no evento = reabertura integral.';
comment on function public.admin_reopen_validation_cycles(uuid[], text, text, uuid, uuid) is
  'Reabre validação em lote (validated → in_validation), preservando FAMI histórico.';
comment on function public.get_validation_form_summary(uuid) is
  'Resumo da visão unificada: contagens por resposta e por necessidade de análise (critérios).';
comment on function public.list_validation_form_page(
  uuid, text, uuid, text, text, text, text, text, integer, integer, text, uuid
) is
  'Lista critérios da fila (p_mode=fila) ou do formulário completo (p_mode=formulario).';
comment on table public.validation_analysis_drafts is
  'Rascunhos de análise administrativa por critério/evidência. Não substituem o veredito oficial.';
comment on column public.validation_analysis_drafts.applied_at is
  'Preenchido quando Confirmar aplica o veredito oficial; rascunho deixa de ser ativo.';
comment on column public.validation_analysis_drafts.revision is
  'Versão otimista (CAS) do rascunho; incrementada a cada alteração efetiva.';
comment on function public.mark_validation_analysis_draft_applied(uuid, text, uuid, uuid) is
  'Marca o rascunho ativo da unidade de validação como aplicado após Confirmar oficial.';
comment on function public.save_validation_analysis_draft(
  uuid, uuid, text, uuid, uuid, text, text, text, bigint
) is
  'Persiste rascunho de análise por critério/evidência sem aplicar veredito oficial nem FAMI.';
comment on table public.form_periods is
  'Período compartilhado de uma form_version. Identidade funcional: period_code; apresentação: label.';
comment on column public.form_periods.period_code is
  'Identidade funcional do período (ex.: 2026.1). UNIQUE por form_version.';
comment on column public.form_periods.label is
  'Rótulo de apresentação. Pode coincidir com period_code.';
comment on column public.form_periods.response_deadline_at is
  'Prazo-base do período. Exceções individuais ficam em cycles.response_deadline_at.';
comment on column public.cycles.period_id is
  'Identidade oficial do período compartilhado (form_periods).';
comment on column public.cycles.period_label is
  'DEPRECATED como identidade. Cache de apresentação sincronizado de form_periods.label.';
comment on function public.apply_workbench_response(uuid, uuid, uuid, public.answer_value, text, bigint, jsonb) is
  'Persiste resposta/evidência do workbench (file, link ou text); proof_requested só é limpo no reenvio do ciclo.';
comment on function public.remove_workbench_evidence_item(uuid, uuid, uuid, uuid, bigint) is
  'Remove evidência pendente do workbench; em correção, permite ajuste documental e comprovação ausente.';
comment on function public.trg_apply_validation_analysis_draft_on_response() is
  'Marca rascunhos oficiais aplicados, inclusive quando admin_proof_status é limpo.';
comment on type public.evidence_kind is
  'Modalidade de comprovação: file, link ou text. Uso de text em constraints/funções apenas após commit desta migration.';
comment on column public.evidences.title is
  'Título genérico da comprovação (todas as modalidades). Distinto de original_filename.';
comment on column public.evidences.text_body is
  'Corpo da comprovação textual. Null para file/link. Distinto de responses.notes.';
comment on column public.evidences.original_filename is
  'Nome original do arquivo enviado. Exclusivo de kind=file.';
comment on function public.supersede_absent_proof_with_evidence(uuid, uuid, uuid, jsonb) is
  'Supera validated_without_proof com auditoria e insere evidência(s) pending (file/link/text). Exige ciclo in_validation.';
comment on view public.evidence_operational_view is
  'Leitura operacional de evidências; inclui axis_name/section_name do snapshot; pending em N/A admin aparece como not_required.';
comment on column public.action_plan_documents.file_validation_status is
  'Estado da validação estrutural do arquivo (ou not_applicable para links).';
comment on function public.list_evidences_page(
  text, text, boolean, uuid, uuid, uuid, uuid, timestamptz, timestamptz, uuid[], integer, integer, text, text, text
) is
  'Página operacional de evidências com filtros opcionais de eixo e seção (snapshot).';
comment on function public.save_respondent_action_plan(
  uuid, uuid, uuid, uuid, text, date, date, text, uuid,
  integer, boolean, bigint, text, text
) is
  'Cria ou atualiza ação do respondente com prazo de início e conclusão; situação deriva do percentual (exceto cancelamento).';
comment on function public.carry_forward_action_plan_documents_on_revision() is
  'Mantém comprovações ativas na revisão corrente após edição da ação; aceites administrativos da revisão antiga continuam inválidos.';
comment on table public.fami_preliminary_processings is
  'Checkpoint quadrimestral versionado do acompanhamento. Nunca substitui cycle_processings/fami_results oficiais.';
comment on column public.fami_preliminary_processings.methodology_version is
  'prelim_v1: FAMI oficial + gap recuperável × progresso médio das ações ativas no corte.';
comment on table public.fami_preliminary_action_snapshots is
  'Estado imutável das ações na data de corte. Ações canceladas são preservadas no snapshot, mas não entram na média de progresso.';
comment on table public.fami_preliminary_criterion_results is
  'Memória de cálculo por critério. official_points reproduz a política congelada do processamento de origem; preliminary_points adiciona somente recuperação pelo plano.';
comment on table public.fami_preliminary_results is
  'Resultado FAMI preliminar por seção, eixo e global. É acompanhamento gerencial e não é Resultado FAMI oficial.';
comment on function public.materialize_fami_preliminary(uuid, integer, smallint, uuid) is
  'Materializa checkpoint prelim_v1 após o fechamento do quadrimestre, usando FAMI oficial e progresso histórico das ações sem alterar fami_results.';