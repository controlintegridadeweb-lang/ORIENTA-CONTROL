# Manutenção controlada

Estes scripts existem para operações excepcionais e **não** fazem parte do fluxo diário da aplicação nem do bootstrap padrão.

- `audit-data-cleanup.mjs`: auditoria somente-leitura de pontos de limpeza de dados.
- `audit-validation-sections.mjs`: auditoria operacional de seções/filas de validação.
- `cleanup-test-form.mjs`: remove formulário de teste e artefatos dependentes; usa simulação por padrão.
- `embed-cover-assets.mjs`: regenera os bytes PNG embutidos da capa do relatório.
- `open-assigned-cycles-2026.mjs`: operação específica da implantação 2026 para órgãos atribuídos sem ciclo.
- `repair-2026-manual-validation.mjs`: reparo controlado da carga 2026 para revisão manual do FAMI.
- `recover-admin-mfa.mjs`: recuperação administrativa auditada de MFA; usa simulação por padrão e exige `--execute` para mutação.

Os dois scripts específicos de carga 2026 podem ser removidos quando o cutover para o novo Supabase estiver concluído, reconciliado e sem necessidade de repetir a operação. Até lá, permanecem isolados nesta pasta para não serem confundidos com migrations ou bootstrap canônico.
