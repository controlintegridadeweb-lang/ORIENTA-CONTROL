# Bootstrap canônico — Diagnóstico de Integridade 2026

Esta pasta define o contrato da **carga inicial real** do ORIENTA 2026. O repositório limpo mantém `private/` vazio; a distribuição privada de implantação inclui os arquivos reais. A carga não é um backup do banco antigo e não preserva a trajetória técnica do Supabase anterior.

## Fonte de verdade

- `supabase/migrations/`: define **como o banco é hoje**.
- `data/bootstrap-2026/private/`: quando presente no pacote privado, define **quais dados reais de 2026 devem existir na implantação inicial**.

A carga da distribuição privada foi derivada do snapshot privado exportado em **12/08/2026 às 09:50:25 UTC** (`orienta-public-2026.05`) e transformada em 22/08/2026 para o contrato atual. Alterações realizadas no Supabase de origem depois de 12/08/2026 não fazem parte desta fotografia.

## O que é preservado

- 42 órgãos e 42 atribuições do formulário;
- 43 usuários/perfis atuais;
- dados funcionais de 22 respondentes históricos quando disponíveis;
- 3 eixos, 22 seções e 126 perguntas;
- formulário publicado, rascunho atual e período;
- **23 ciclos que possuem respostas**;
- 2.898 respostas;
- 509 evidências/comprovações (506 links e 3 evidências textuais);
- estado atual das decisões administrativas armazenadas em `responses` e `evidences`.

## O que deliberadamente não é preservado

Não entram no bootstrap: `audit_logs`, snapshots, notificações, eventos de reabertura/submissão/prazo, processamentos antigos, séries históricas de FAMI, recomendações materializadas antigas, planos de ação antigos e relatórios antigos.

Esses dados descrevem **como o sistema antigo chegou ao estado atual**. A nova implantação começa com o estado real necessário para continuar o diagnóstico e passa a produzir seu próprio histórico.

## Transformação de evidências

O snapshot antigo ainda possuía `malware_scan_*`. O schema atual usa `file_validation_status`/`file_validated_at`. Como as 509 evidências desta carga são somente `link` ou `text`, a transformação canônica é determinística:

- remove `malware_scan_*`;
- define `file_validation_status = "not_applicable"`;
- define `file_validated_at = null`.

O conversor falha explicitamente se encontrar evidência física `kind = "file"`; ele não inventa resultado de validação de arquivo.

## Segurança

`private/` contém dados institucionais e dados pessoais somente na distribuição privada de implantação. A pasta é ignorada pelo Git e deve permanecer vazia no projeto destinado a repositório. Não publique seu conteúdo.

O inventário Auth é seguro para migração: não contém hash de senha nem tokens. Contas novas recebem senha temporária gerada no destino em `var/bootstrap/bootstrap-2026-users.credentials.csv`, arquivo ignorado pelo Git.

## Validação local da carga

```bash
npm run bootstrap:2026:verify
```

O comando valida checksums, contagens, referências internas, ciclos com respostas e o contrato atual das evidências.

## Implantação em outro Supabase

Configure `.env.local` para o **novo** projeto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ACCESS_TOKEN=sbp_...
```

Depois:

```bash
npm ci
npm run bootstrap:2026:verify
npm run db:push:api
npm run bootstrap:2026:dry-run
npm run bootstrap:2026
npm run bootstrap:2026:verify
```

`db:push:api` e `bootstrap:2026` usam HTTPS e não dependem de saída TCP 5432/6543.

## Regerar a carga a partir do snapshot original

Extraia o snapshot privado até obter o diretório `output/export/` e execute:

```bash
npm run bootstrap:2026:build-from-snapshot -- --source=/caminho/para/output/export
npm run bootstrap:2026:verify
```

O conversor preserva somente o estado definido como canônico e não copia históricos descartados.
