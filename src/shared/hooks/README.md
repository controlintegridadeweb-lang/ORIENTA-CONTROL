# Convenção de localização de hooks

1. Hook genérico, sem dependência de domínio, fica em `src/shared/hooks/`.
   Exemplos: `use-debounce`, `use-pagination`, `use-latest-request-guard`.
2. Hook específico de um domínio fica em `src/features/<domínio>/hooks/` ou junto aos componentes do domínio.
3. Composição de interface pertencente a um único fluxo fica na feature proprietária.
4. Orquestração que coordena múltiplos domínios fica em `src/application/`; a camada de aplicação não contém componentes React.
5. Hooks compartilhados não podem importar `features`, `infrastructure` ou `application`.

## Regra de bolso

- Reutilizável sem conhecer o negócio: `src/shared/hooks/`.
- Conhece uma regra ou serviço do domínio: `src/features/<domínio>/`.
- Coordena múltiplos domínios sem renderizar UI: `src/application/`.
- Se a composição existe apenas para uma jornada de produto, defina explicitamente a feature proprietária em vez de criar uma camada genérica.
