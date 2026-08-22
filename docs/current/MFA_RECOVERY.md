# Recuperação administrativa de MFA

A ORIENTA não permite que uma sessão em `aal1` remova o próprio segundo fator. Essa restrição evita que a posse da senha seja suficiente para desativar o MFA.

## Pré-condições

1. Confirmar a identidade do administrador por um canal independente da sessão afetada.
2. Registrar uma referência verificável da confirmação, como número de chamado ou processo interno.
3. Executar o procedimento com uma credencial operacional autorizada, nunca pelo navegador do usuário.
4. Informar um motivo detalhado e o operador responsável.

## Simulação

```bash
npm run security:mfa-recover -- \
  --user-id <UUID_DO_ADMINISTRADOR> \
  --reason "Perda do dispositivo autenticador confirmada pelo procedimento interno." \
  --confirmation-reference "CHAMADO-12345" \
  --operator "Equipe de infraestrutura"
```

A simulação valida o perfil e informa a quantidade de fatores TOTP sem removê-los.

## Execução

Após a confirmação independente, repita o comando com `--execute`:

```bash
npm run security:mfa-recover -- \
  --user-id <UUID_DO_ADMINISTRADOR> \
  --reason "Perda do dispositivo autenticador confirmada pelo procedimento interno." \
  --confirmation-reference "CHAMADO-12345" \
  --operator "Equipe de infraestrutura" \
  --execute
```

O script:

- confirma que o usuário-alvo possui perfil `admin`;
- registra `admin_mfa_recovery_started` na auditoria append-only;
- remove somente fatores TOTP do usuário informado;
- registra `admin_mfa_recovery_completed`;
- se houver falha parcial, registra `admin_mfa_recovery_failed` com a quantidade já removida;
- correlaciona os eventos por um identificador de operação;
- não imprime IDs dos fatores nem segredos.

Se ocorrer falha após o evento inicial, a trilha permanece registrada para investigação. O administrador deverá cadastrar um novo fator no próximo login.
