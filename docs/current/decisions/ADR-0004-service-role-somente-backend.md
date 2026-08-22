# ADR-0004 — Service role somente no backend

- **Status:** aceito
- **Data:** 2026-07-27

## Contexto
A chave `service_role` ignora RLS e sua exposição ao navegador comprometeria todo o isolamento.

## Decisão
Criar o cliente privilegiado apenas em `src/infrastructure/supabase/server.ts`, marcado como `server-only`. Rotas devem autenticar e validar escopo antes de qualquer consulta privilegiada.

## Alternativas consideradas
- Expor chave privilegiada em variável pública: proibido por comprometer todo o banco.
- Criar clientes privilegiados dispersos: descartado por dificultar auditoria e controle de importações.

## Regra preservada
A `service_role` nunca integra bundle cliente e só é usada após autenticação, autorização e validação do escopo no backend.

## Consequências
Nenhuma variável sensível usa prefixo `NEXT_PUBLIC_`. Componentes cliente não podem importar módulos server-only. Testes de contrato verificam essa fronteira.
