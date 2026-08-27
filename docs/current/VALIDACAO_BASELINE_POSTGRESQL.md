# Validação da baseline em PostgreSQL real

## Escopo da evidência

A baseline greenfield de 10 migrations (`20260812000100` a `20260812001000`) foi aplicada e validada em PostgreSQL real em **12/08/2026**. Essa prova confirma que a instalação limpa nasce diretamente no estado estrutural consolidado, sem depender da sequência legada de migrations.

As **11 evoluções pós-baseline** existentes no repositório atual foram adicionadas depois dessa prova específica. Elas permanecem cobertas pelos gates de migrations e pelo job `Database integration (Supabase local)` do CI; portanto, esta página não deve ser interpretada como evidência de execução remota dessas evoluções.

## O que foi comprovado na baseline

- migrations executáveis em ordem de dependências;
- RLS habilitado nas tabelas públicas relevantes;
- buckets privados de evidências, planos de ação e relatórios;
- funções com `search_path` explícito;
- helpers privilegiados de autorização fora do schema público exposto;
- views públicas com `security_invoker`;
- ausência de dados aplicativos semeados pela baseline;
- separação entre FAMI oficial e FAMI preliminar;
- bootstrap do Diagnóstico 2026 mantido fora da baseline de produção e disponível apenas como fixture de teste.

## Fonte de verdade atual

Os números e contratos atuais do schema **não** devem ser copiados desta evidência histórica. A fonte executável é sempre:

- `supabase/migrations/`;
- `src/infrastructure/supabase/database.types.ts`;
- `npm run db:audit:migrations`;
- `npm run check:generated-types` contra Supabase local limpo.

O estado atual possui 10 migrations de baseline + 11 evoluções pós-baseline. Consulte `docs/current/BANCO.md` para o inventário vigente.
