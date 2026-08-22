# Backup e restore drill

Backups devem ser criptografados antes de gravados em disco, armazenados fora do repositório e testados periodicamente. Um backup só é válido após restore e `db:verify` aprovados.

## Backup

Pré-requisitos: `pg_dump` e `age`.

```bash
export SUPABASE_DB_URL='postgresql://...'
export BACKUP_AGE_RECIPIENT='age1...'
npm run backup:production -- --output-dir /volume-seguro/orienta
```

O arquivo é criado de forma atômica, em modo restrito, acompanhado de SHA-256.

## Restore drill

```bash
export RESTORE_DRILL_TARGET_DB_URL='postgresql://.../orienta_restore'
export RESTORE_DRILL_CONFIRM_TARGET='host-do-destino/orienta_restore'
export BACKUP_AGE_IDENTITY='/cofre/age-identity.txt'
export SUPABASE_DB_URL='postgresql://producao...'
npm run restore:drill -- --file /volume-seguro/orienta/backup.dump.age
npm run restore:drill -- --file /volume-seguro/orienta/backup.dump.age --execute
```

O primeiro comando simula e confere checksum/destino. O segundo restaura e executa `db:verify`.

Registre data, responsável, checksum, duração, resultado, divergências e RPO/RTO observados.
