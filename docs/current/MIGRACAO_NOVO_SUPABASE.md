# Migração do ORIENTA para um novo Supabase

## Objetivo

Criar um projeto Supabase novo usando o schema vigente e carregar apenas o estado real necessário do Diagnóstico de Integridade 2026, sem transportar o histórico técnico do banco anterior.

## Ordem canônica

```text
Novo projeto Supabase
  → configurar credenciais locais
  → validar bootstrap privado
  → aplicar migrations atuais por HTTPS
  → dry-run da carga
  → importar Auth + dados públicos
  → validar contagens e referências
  → executar gates de aplicação
```

## 1. Configurar o destino

Copie `.env.example` para `.env.local` e preencha apenas valores do novo projeto. Não reutilize chaves do Supabase antigo.

Variáveis necessárias para a migração:

- `NEXT_PUBLIC_SUPABASE_URL`;
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
- `SUPABASE_SERVICE_ROLE_KEY`;
- `SUPABASE_ACCESS_TOKEN`.

## 2. Instalar e validar a carga local

```bash
npm ci
npm run bootstrap:2026:verify
```

A **distribuição privada de implantação** contém a carga em `data/bootstrap-2026/private/`, derivada do snapshot de 12/08/2026. O ZIP limpo para desenvolvimento/repositório mantém essa pasta vazia por segurança.

## 3. Aplicar o banco

```bash
npm run db:push:api
```

Esse caminho usa a Management API HTTPS e foi escolhido para ambientes onde as portas PostgreSQL 5432/6543 estão bloqueadas.

## 4. Simular e importar

```bash
npm run bootstrap:2026:dry-run
npm run bootstrap:2026
```

O importador é idempotente nas tabelas públicas. Usuários Auth são reconciliados por e-mail; IDs antigos são remapeados para os IDs do novo projeto quando necessário.

## 5. Credenciais temporárias

Quando uma conta Auth precisa ser criada, a senha temporária é gravada localmente em:

```text
var/bootstrap/bootstrap-2026-users.credentials.csv
```

O arquivo é sensível, é ignorado pelo Git e deve ser removido após a entrega segura das credenciais.

## 6. Verificação

```bash
npm run bootstrap:2026:verify
npm run check:generated-types
npm run db:verify
```

Em ambiente com Docker/Supabase CLI, execute também a suíte de integração e E2E usada pelo CI.

## Conteúdo real preservado

- 42 órgãos;
- 43 usuários/perfis;
- 22 detalhes funcionais de respondentes;
- 3 eixos;
- 22 seções;
- 126 perguntas e versões;
- 42 atribuições;
- 23 ciclos com respostas;
- 2.898 respostas;
- 509 evidências.

## Histórico deliberadamente descartado

Não são importados logs de auditoria, snapshots, notificações, eventos históricos, processamentos antigos, séries históricas de FAMI, recomendações/planos antigos e relatórios antigos. O objetivo é transportar o **estado vigente necessário**, não reproduzir a trajetória do banco legado.

## Limite temporal da fotografia

A origem foi exportada em 12/08/2026. Se o Supabase antigo recebeu alterações reais depois dessa data, é necessário gerar um snapshot mais recente e reconstruir o bootstrap com `bootstrap:2026:build-from-snapshot` antes do cutover.
