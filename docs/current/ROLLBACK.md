# Rollback de produção

Rollback da aplicação e do banco são decisões diferentes. Nunca reverta migrations aplicadas apagando ou alterando o histórico.

## Aplicação

1. Interrompa novos deploys.
2. Identifique o último deployment saudável e commit.
3. Confirme compatibilidade com o schema atual.
4. Reimplante o artefato anterior.
5. Execute smoke, confira logs, crons e autenticação.

## Banco

Antes da primeira gravação real, o cutover pode ser abortado. Depois dela, não retorne a uma origem antiga sem reconciliar os dados do destino. Mudanças incompatíveis exigem migration corretiva posterior.

Acione rollback em falha de readiness prolongada, erro crítico de Auth/RLS/FAMI, perda/exposição de dados, 5xx elevado ou workers sem recuperação.
