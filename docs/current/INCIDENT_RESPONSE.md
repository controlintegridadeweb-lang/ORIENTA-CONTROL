# Resposta a incidentes

| Nível | Exemplo | Resposta inicial |
|---|---|---|
| SEV-1 | exposição/perda de dados, RLS violado, indisponibilidade total | imediata |
| SEV-2 | fluxo crítico, FAMI ou relatório incorreto | até 30 minutos |
| SEV-3 | degradação parcial com alternativa | até 4 horas |

1. Nomear responsável.
2. Preservar logs e `x-request-id`.
3. Confirmar liveness e readiness.
4. Pausar deploys/automação que ampliem o impacto.
5. Avaliar rollback.
6. Comunicar impacto real sem especulação.

Em suspeita de comprometimento, rotacione segredos, revogue sessões, preserve auditoria append-only e não copie dados pessoais para tickets. O pós-incidente deve registrar linha do tempo, causa raiz, impacto, ações e testes de regressão.
