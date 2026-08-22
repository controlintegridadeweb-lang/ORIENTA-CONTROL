# Scripts operacionais

Os scripts são organizados pela responsabilidade, não pela etapa histórica em que foram criados.

| Diretório | Responsabilidade |
|---|---|
| `bootstrap/` | carga inicial e reconstrução canônica de 2026 |
| `database/` | migrations, tipos, link/push/reset e verificações de banco |
| `imports/` | importações de fontes externas e reconciliação |
| `maintenance/` | operações administrativas excepcionais e reparos controlados |
| `production/` | deploy, smoke, backup, restore e go-live |
| `testing/` | Supabase local, fixtures e preparação E2E |
| `verification/` | gates estáticos de arquitetura, segurança, complexidade e consistência |
| `shared/` | utilitários compartilhados exclusivamente entre scripts |

O CI é definido em `.github/workflows/` e deve invocar os comandos públicos de `package.json`; não deve depender de caminhos internos quando existe um script npm equivalente.

Scripts em `maintenance/` não fazem parte do fluxo normal da aplicação. Eles devem ser executados apenas para o caso explicitamente documentado e, quando aplicável, em modo de simulação primeiro.
