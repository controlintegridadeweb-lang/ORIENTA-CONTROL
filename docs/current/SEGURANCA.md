# Segurança — autorização, RLS e isolamento entre organizações

Este documento descreve o contrato atual de segurança. A aprovação final deve
ser feita executando a suíte SQL em uma instância Supabase local antes de cada
primeira aplicação ou alteração de schema.

## Camadas de proteção

1. **RLS no PostgreSQL.** Tabelas de ciclo, respostas, evidências,
   recomendações, planos e relatórios usam `current_organization_id()` para
   impedir leitura cruzada por usuários autenticados. Escritas sensíveis ficam
   restritas a RPCs e serviço de backend.
2. **Autorização de rota.** APIs usam `requireAuth` ou `withRoute` com papéis
   explícitos (`admin` ou `respondent`). A leitura do próprio perfil usa a mesma
   sessão validada e a policy `profiles_self_read`; a decisão de papel não usa
   `service_role`.
3. **Escopo de organização.** Existe um administrador único e global, sem
   vínculo com organização; respondentes operam apenas na organização do próprio
   perfil. Guards como `ensureOrganizationAccess`, `ensureRecommendationAccess`,
   `ensureResponseAccess` e `ensureRespondentAssignmentAccess` aplicam essa
   regra antes de operações com service role.
4. **Storage privado.** Os buckets `evidencias`, `planos-acao` e `relatorios`
   não são públicos. O acesso é por URL assinada emitida no backend após
   validação de escopo e `file_validation_status = valid`.
5. **Uploads endurecidos.** Evidências do diagnóstico e comprovações do plano têm
   limite único de 20 MB, formatos restritos (PDF, PNG, JPEG, WebP) e validação
   de assinatura e estrutura real antes de ficarem disponíveis.
   **A Plataforma ORIENTA não realiza varredura antimalware nesta versão.**
   A segurança dos uploads utiliza restrição de formatos, validação estrutural,
   armazenamento privado, autorização, entrega segura e auditoria.
6. **Proteção operacional.** Rotas pesadas usam rate limiting atômico no banco.
   Login e recuperação de senha também possuem limites persistentes por conta e
   rede, além dos limites do Supabase Auth. Mutações autenticadas por cookie
   exigem `Origin` exato e Fetch Metadata compatível, bloqueando CSRF. Cabeçalhos
   HTTP aplicam CSP, bloqueio de MIME sniffing, framing, políticas de
   referência/permissões e HSTS em produção.
7. **Segredos fora das filas.** Jobs de importação não persistem senha provisória
   nem link de recuperação. Constraints do banco rejeitam essas chaves e dados
   operacionais concluídos possuem retenção limitada.
8. **Logs e auditoria protegidos.** O logger remove tokens, cookies, senhas,
   chaves, URLs assinadas e e-mails dos contextos. Stacks completas não são
   registradas em produção, e as respostas HTTP nunca recebem detalhes internos
   do erro. `audit_logs` e `library_audit_events` são append-only: até o
   `service_role` possui apenas `SELECT` e `INSERT`, enquanto triggers bloqueiam
   `UPDATE`, `DELETE` e `TRUNCATE`.

## Contratos canônicos

- Respostas e evidências pertencem ao ciclo e à versão de formulário congelada.
- Upload de evidência: `{organization_id}/{cycle_id}/{arquivo}`. O navegador
  envia diretamente ao bucket privado por URL assinada; o backend valida o
  objeto real antes de marcá-lo como disponível para associação à resposta.
- O respondente só altera resposta/evidência pelas rotas server-side, em
  `in_response` ou `awaiting_adjustment`; a Data API não possui grant de mutação.
- Comprovações do plano usam
  `{organization_id}/{action_plan_id}/{object_id}-{nome}` no bucket privado
  `planos-acao`. O navegador envia diretamente por URL assinada; a API congela
  o escopo em `pending_action_plan_document_uploads`, valida o objeto real por
  leituras parciais e só então o materializa por RPC atômica e idempotente. Abandonos e
  desativações registram uma outbox transacional; a exclusão física é retomada
  com backoff quando o Storage estiver indisponível.
- Relatórios usam `{organization_id}/{cycle_id}/{cycle_processing_id}/{emission_id}.pdf`; cada reemissão cria outro arquivo imutável.
- A submissão do respondente ocorre por
  `/api/respondent/cycles/[cycleId]/submit`; não existe rota alternativa por
  formulário.
- Configuração editorial da biblioteca altera a seção exclusivamente em
  `questions.section_id`; `question_library_binding` não replica eixo ou seção.

## Validação obrigatória

```bash
supabase start
supabase db reset --local
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run db:verify
npm run db:verify:reports
```

A verificação cobre RLS, editabilidade por estado de ciclo, Storage, snapshots,
FAMI, reabertura e validação de evidência. O fluxo de relatório exercita upload,
registro, URL assinada e download.

## Autenticação endurecida

- Senhas possuem mínimo de 12 caracteres e exigem maiúscula, minúscula, número
  e símbolo, tanto nas interfaces quanto no Supabase Auth.
- Alteração de senha exige sessão recente (`secure_password_change`).
- Sessões expiram após 12 horas ou duas horas de inatividade.
- A conta administrativa exige MFA TOTP. Uma sessão em `aal1` pode autenticar,
  mas não acessa páginas nem APIs administrativas até confirmar o segundo fator
  e alcançar `aal2`.
- O primeiro acesso administrativo apresenta QR Code e chave manual para
  cadastro em aplicativo autenticador.
- A CSP usa nonce por requisição e `strict-dynamic`; scripts inline sem nonce
  não são aceitos. Elementos `<style>` também exigem nonce em produção. Apenas
  atributos `style` necessários aos componentes dinâmicos permanecem permitidos
  por `style-src-attr`.
- Toda rota autenticada `POST`, `PUT`, `PATCH` ou `DELETE` recebe rate limit
  persistente no PostgreSQL, salvo quando a rota declara explicitamente uma
  política própria mais adequada.
- Login passa por `/api/auth/sign-in`, com validação de origem e limites por
  conta+rede e por rede. Recuperação de senha possui limites equivalentes.
- Clientes com Bearer token não dependem de cookies; mutações por sessão de
  navegador falham fechadas sem `Origin` autorizado.

### Recuperação do MFA administrativo

Uma sessão em `aal1` nunca pode remover o próprio fator. A recuperação é feita
exclusivamente pelo procedimento operacional documentado em
[`MFA_RECOVERY.md`](./MFA_RECOVERY.md):

1. confirmar a identidade por canal independente;
2. registrar motivo, operador e referência do chamado;
3. executar `npm run security:mfa-recover` primeiro em modo simulação;
4. repetir com `--execute` somente após a confirmação;
5. verificar os eventos append-only `admin_mfa_recovery_started` e
   `admin_mfa_recovery_completed`; uma falha parcial gera
   `admin_mfa_recovery_failed`;
6. exigir o cadastro de um novo fator no próximo login.

Nunca desative a exigência de MFA no código para recuperar acesso.

## Concorrência e sincronização

Respostas, evidências vinculadas à resposta e ações do plano usam controle
otimista por `revision`:

1. a interface lê a revisão atual;
2. envia `expectedRevision` na mutação;
3. a RPC bloqueia a linha e compara a revisão esperada;
4. divergência retorna HTTP 409 com orientação para recarregar;
5. somente a gravação baseada na revisão atual é aceita.

As comprovações da execução passam pela mesma cadeia de proteção das evidências
do diagnóstico: upload direto assinado, registro temporário backend-only,
validação de tamanho e formato real, bucket privado, caminho por organização/ação,
`file_validation_status`, URL assinada de curta duração e limpeza compensatória
por fila durável. O aceite administrativo só pode referenciar documentos com
formato validado ou links HTTPS da revisão atual da ação.

As tabelas `responses`, `action_plans` e `action_plan_documents` usam
`REPLICA IDENTITY FULL`, participam
da publicação `supabase_realtime` e respeitam RLS durante a entrega dos eventos.
Telas abertas recebem sinalização/recarga quando outro usuário ou outra aba
altera o mesmo diagnóstico. O Realtime melhora a atualização visual, mas não é
a garantia de integridade: a proteção definitiva permanece na comparação
transacional de revisão no PostgreSQL.

## Configuração obrigatória do Supabase remoto

`supabase/config.toml` valida o ambiente local. Antes da produção, confirme no
projeto remoto, pois essas opções não são aplicadas ao Dashboard apenas por um
deploy da Vercel:

- TOTP habilitado;
- política de senha equivalente à do repositório;
- duração máxima e expiração por inatividade;
- cadastro público desabilitado;
- limites de sign-in/verificação equivalentes ou mais restritivos que
  `supabase/config.toml`;
- o proxy de borda deve sobrescrever os headers de endereço de rede usados pelo
  rate limit; nunca confie em headers encaminhados diretamente pelo cliente;
- frequência mínima de 60 segundos para recuperação por e-mail;
- proteção contra senhas comprometidas, quando disponível no plano;
- SSL obrigatório para conexões diretas ao PostgreSQL;
- restrições de rede permitindo apenas operadores/CI que realmente usam conexão
  direta. A aplicação web usa as APIs do Supabase e não precisa expor a porta do
  banco à internet inteira.
