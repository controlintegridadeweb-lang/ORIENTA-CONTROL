# Alteração do prazo de conclusão de ações

## Regra de domínio

O prazo de conclusão (`action_plans.due_date`) de uma ação já cadastrada é um compromisso administrativo. O respondente não o edita diretamente.

Fluxo canônico:

1. o respondente informa novo prazo e justificativa;
2. o prazo vigente permanece inalterado;
3. a supervisão administrativa analisa a solicitação;
4. rejeição preserva o prazo vigente;
5. aprovação altera `action_plans.due_date`, incrementa a revisão da ação e registra a decisão.

## Persistência

A migration evolutiva `20260812001100_action_plan_deadline_change_requests.sql` adiciona:

- enum `action_plan_deadline_change_status` (`pending`, `approved`, `rejected`);
- tabela `action_plan_deadline_change_requests`;
- uma solicitação pendente por ação;
- RPC `request_action_plan_deadline_change`;
- RPC `decide_action_plan_deadline_change`;
- trigger `action_plans_guard_due_date_change` para bloquear alteração direta do prazo;
- auditoria da solicitação e notificações para administrador/respondente;
- RLS de leitura escopada por organização ou administrador global.

As 10 migrations da baseline greenfield permanecem preservadas. Esta é a primeira evolução posterior à baseline validada.

## Interface

### Respondente

A edição cadastral da ação mostra o prazo de conclusão como somente leitura. A opção **Solicitar prazo** abre um fluxo separado com:

- prazo vigente;
- novo prazo solicitado;
- justificativa obrigatória;
- estado da solicitação pendente;
- histórico das últimas decisões.

### Administrador

A Central de Supervisão apresenta solicitações pendentes com:

- ação;
- prazo vigente e solicitado;
- justificativa da organização;
- justificativa administrativa obrigatória;
- ações **Aprovar novo prazo** e **Não aprovar**.

## Prova no PostgreSQL real

A migration foi aplicada no projeto Supabase ORIENTA em 12/08/2026.

Uma prova transacional com fixtures temporárias, executada com os triggers normais ativos e `ROLLBACK` ao final, confirmou:

- `UPDATE due_date` direto é recusado (`42501`);
- criar solicitação não altera prazo nem revisão;
- segunda solicitação pendente da mesma ação é recusada;
- rejeição não altera prazo nem revisão;
- uma nova solicitação pode ser criada após rejeição;
- aprovação altera o prazo e incrementa a revisão da ação;
- `applied_action_revision` registra a revisão resultante.

Nenhuma fixture da prova foi persistida.

## Segurança

- RPCs de escrita não são concedidas a `anon`/`authenticated`; a API server-side usa o `service_role` após autenticação/autorização de rota.
- a tabela possui RLS e leitura escopada;
- alteração direta de `due_date` é protegida no banco;
- o histórico usa FKs `ON DELETE RESTRICT` para preservar rastreabilidade.

O Security Advisor não apontou warning específico para esta funcionalidade. A pendência externa já conhecida do projeto continua sendo `Leaked Password Protection` do Supabase Auth.
