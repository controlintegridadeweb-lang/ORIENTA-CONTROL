# Política de segurança
Não publique vulnerabilidades, credenciais, dados pessoais ou evidências institucionais em issues públicas.
Relate o problema pelo canal privado de segurança definido pela equipe responsável, incluindo componente, impacto, passos mínimos, versão/commit e evidências sem dados pessoais.
A equipe deve preservar logs e seguir [`docs/current/INCIDENT_RESPONSE.md`](docs/current/INCIDENT_RESPONSE.md). Correções devem incluir teste de regressão e não podem editar migrations já aplicadas.

## Artefatos e credenciais operacionais

Scripts versionados não podem conter credenciais reais ou credenciais reutilizáveis de diagnóstico. Antes do release execute:

```bash
npm run check:sensitive-artifacts
```

Credenciais de origem/destino, backup e restore devem existir somente no ambiente administrativo apropriado e nunca em arquivos versionados ou no bundle público.
