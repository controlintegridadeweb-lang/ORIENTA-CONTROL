# Prontidão para produção

Nenhum gate pode ser aprovado apenas por inspeção visual.

## 1. Código

```bash
npm ci
npm run release:static
```

Devem passar lockfile, typecheck, testes, cobertura, lint, dead code, build, arquitetura, complexidade, segurança e migrations. Dependências de runtime não podem ter vulnerabilidade alta ou crítica.

## 2. Configuração

```bash
npm run check:production-env
```

O gate rejeita URLs sem HTTPS, placeholders, segredos fracos/repetidos, webhooks incompletos e credenciais administrativas no runtime.

## 3. Banco

```bash
supabase db reset --local
npm run db:audit:migrations
npm run db:greenfield
npm run db:verify
npm run check:generated-types
npm run db:verify:reports
```

As 10 migrations da baseline consolidada (`20260812000100`–`20260812001000`) permanecem imutáveis, e todas as migrations evolutivas posteriores também devem ser aplicadas em ordem sem falha; os tipos gerados não podem divergir.

## 4. Funcional

```bash
npm run test:e2e
```

Homologar login, MFA, RLS, upload com validação estrutural, devolução, reabertura, FAMI, recomendações, plano de ação, relatório e concorrência otimista.

## 5. Operacional

- `GET /api/health/live`: processo ativo.
- `GET /api/health/ready`: configuração, banco, Auth, buckets privados e infraestrutura de upload.
- Readiness exige `Authorization: Bearer <HEALTHCHECK_SECRET>`.

```bash
HEALTHCHECK_SECRET=... npm run smoke:production -- --base-url https://dominio
```

## 6. Continuidade

Antes do go-live: backup criptografado, restore drill em banco isolado, RTO/RPO aprovados, responsáveis de incidente/rollback e janela de implantação definidos.

Consulte [`BACKUP_RESTORE.md`](./BACKUP_RESTORE.md), [`ROLLBACK.md`](./ROLLBACK.md) e [`INCIDENT_RESPONSE.md`](./INCIDENT_RESPONSE.md).

## 7. Go-live

Autorizar somente quando todos os gates estiverem verdes no mesmo commit e ambiente, o smoke confirmar o commit implantado, não houver bloqueadores, backup/rollback estiverem testados e a homologação estiver assinada.

O checklist versionado começa obrigatoriamente como `pending`. Valide somente a estrutura com:

```bash
npm run check:go-live -- --schema-only
```

O gate final é deliberadamente mais rígido:

```bash
npm run check:go-live
```

Ele só aprova quando commit, deployment, URL HTTPS, aprovador, data e evidência de todos os gates reais estiverem preenchidos. Não transforme itens pendentes em `approved` sem evidência executada.

## 8. Proteção do fluxo de entrega

O branch `main` deve bloquear push direto e exigir os jobs `quality`, `database-integration` e `end-to-end` do workflow CI. A revisão deve ocorrer antes do merge.

A estratégia recomendada é:

1. gerar um deployment imutável de preview/staging;
2. executar **Release readiness** contra a URL desse deployment;
3. promover exatamente o mesmo artefato aprovado para produção;
4. executar novamente o smoke na URL canônica;
5. registrar commit, deployment, relatórios e aprovador no checklist de go-live.

Não reconstrua outro commit entre homologação e promoção.
