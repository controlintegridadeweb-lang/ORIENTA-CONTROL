# Testes E2E

- `orienta-canonical-flow.spec.ts` mantém uma jornada serial única porque os cenários compartilham o mesmo ciclo criado no navegador.
- Helpers reutilizáveis ficam em `support/`.
- Fixtures de contas e seletores ficam em `fixtures/`.
- Fluxos independentes devem ser adicionados em arquivos próprios, sem aumentar a jornada canônica.
