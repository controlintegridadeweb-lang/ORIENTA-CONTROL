# Verificação real de banco e Storage

A aplicação possui duas camadas complementares de proteção de evidências:

1. `responses` e `evidences` não aceitam mutação direta por `authenticated`;
   o respondente grava somente pelas rotas server-side e RPCs transacionais.
2. As rotas de escrita do workbench aceitam exclusivamente o perfil
   `respondent`; o administrador acompanha e valida, mas não responde nem anexa
   evidências em nome da organização.
3. Objetos do bucket privado `evidencias` são enviados primeiro como upload
   pendente. Somente a RPC transacional que grava a resposta os associa a uma
   evidência definitiva.

## Caminho canônico de novos arquivos

```text
{organization_id}/{cycle_id}/{object_id}-{nome-sanitizado}
```

O segundo segmento é o `cycle_id`. Não há formato alternativo aceito: uploads,
remoções e downloads passam exclusivamente pelo backend e usam esse caminho.

## Ciclo de vida de upload pendente

1. o backend valida nome, extensão, MIME e tamanho declarado, cria
   `pending_evidence_uploads` e devolve uma URL de upload assinada;
2. o navegador envia o arquivo diretamente ao bucket privado, sem carregar o
   conteúdo inteiro na memória do servidor Next.js;
3. o backend baixa apenas os intervalos necessários, confere tamanho real,
   assinatura binária e estrutura do arquivo;
4. somente depois da validação estrutural o upload pendente fica disponível para salvar;
5. ao salvar a resposta, `apply_workbench_response` valida ciclo, organização,
   usuário e caminho antes de associar a evidência e remover o registro pendente;
6. ao remover ou substituir um anexo antes do salvamento, o objeto e o registro
   pendente são descartados;
7. `GET /api/maintenance/pending-evidence-cleanup`, protegido por
   `CRON_SECRET`, remove pendências vencidas. Em Vercel, a rotina está agendada
   diariamente em `vercel.json`.

Antes da associação, o backend exige `file_validation_status = valid` no registro
pendente. Falha na validação estrutural impede a criação da evidência; arquivos
rejeitados removem o upload temporário.

**A Plataforma ORIENTA não realiza varredura antimalware nesta versão.** A
segurança dos uploads utiliza restrição de formatos, validação estrutural,
armazenamento privado, autorização, entrega segura e auditoria.

O upload pendente não é uma evidência oficial e não pode ser reutilizado por
outro ciclo, organização ou usuário. O limite canônico é 20 MB e os formatos
aceitos são PDF, PNG, JPEG e WebP. Arquivos renomeados para um desses formatos
sem assinatura compatível são rejeitados.

## Executar contra Supabase local

Requer Docker e Supabase CLI:

```bash
supabase start
supabase db reset --local
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
DB_VERIFY_ONLY=1 npm run db:verify
supabase stop
```

O script executa migrations/seed no modo normal. Com `DB_VERIFY_ONLY=1`, ele
não reaplica migrations: usa o schema real já criado pelo Supabase local e roda
somente os seeds e verificações SQL.

## Cobertura do verifier

- auditoria com ator real;
- preservação de histórico em reabertura;
- FAMI com waiver;
- RPC transacional de validação de evidência;
- identidade de perfil: alteração direta de papel/organização falha de forma
  explícita, enquanto a RPC administrativa autorizada persiste a mudança;
- leitura RLS escopada e bloqueio de mutação direta em `responses` e
  `evidences`, incluindo o vínculo estrutural entre pergunta e formulário;
- invariantes de snapshots: consistência de “não aplicável”, referência composta
  de evidência e contrato de arquivo/link;
- ausência de grants/policies diretos de `authenticated` em `storage.objects`;
- invariantes de `pending_evidence_uploads`, incluindo expiração, escopo do
  usuário e remoção após associação transacional;
- histórico de relatórios paginado por views, sem truncamento silencioso de
  emissões antigas.

O workflow de CI executa a mesma verificação em uma stack Supabase local real.
