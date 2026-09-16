# Domínio institucional (COTIC)

A aplicação continua hospedada na Vercel e autenticada no Supabase. O domínio
institucional é apenas um DNS apontado para a Vercel. Este repositório não
configura DNS.

Durante a transição, `https://<projeto>.vercel.app` e o domínio institucional
podem coexistir. Não há redirect obrigatório no código.

## Vercel

Em **Project → Settings → Domains**, adicione exatamente:

`orienta.control.rn.gov.br`

A Vercel exibirá os registros DNS (tipo, nome e valor) para esse host. Use
**somente** esses registros. Não invente CNAME, A ou AAAA a partir desta
documentação.

O domínio principal (canonical) da Vercel deve ser definido depois, quando o
DNS institucional estiver ativo. Até lá, mantenha o `*.vercel.app` publicado.

## COTIC

A COTIC continua administrando o domínio. Cabe a ela criar, no DNS, os
registros fornecidos pela Vercel após a inclusão do host. Nenhum registro deve
ser improvisado a partir do código ou deste arquivo.

## Variável de ambiente na Vercel

Quando o domínio institucional estiver respondendo em HTTPS:

```text
NEXT_PUBLIC_APP_URL=https://orienta.control.rn.gov.br
```

Cadastre em **Project → Settings → Environment Variables** (Production) e faça
um **redeploy**. `NEXT_PUBLIC_*` entra no bundle no build.

Até o DNS institucional estar ativo, mantenha `NEXT_PUBLIC_APP_URL` na origem
HTTPS temporária da Vercel (`https://<projeto>.vercel.app`). Não aponte essa
variável para o domínio da COTIC enquanto ele não resolver.

Localmente, `.env.example` usa `http://localhost:3002`. Não copie esse valor
para a Vercel.

## Supabase

Não altere o painel automaticamente por este repositório. Depois que o domínio
institucional estiver no ar, revise em **Authentication → URL Configuration**:

- **Site URL:** `https://orienta.control.rn.gov.br`
- **Redirect URLs:** `https://orienta.control.rn.gov.br/**`

Mantenha também, enquanto ainda forem usados:

- `http://localhost:3002/**` e `http://127.0.0.1:3002/**` (desenvolvimento)
- `https://<projeto>.vercel.app/**` (domínio temporário da Vercel)

Confira em especial login, recuperação de senha, confirmação de e-mail e
qualquer link gerado pelo Auth. Pedidos de recuperação feitos antes da mudança
continuam apontando para o destino antigo; solicite um e-mail novo após alterar
as URLs.

O `supabase/config.toml` do repositório vale só para o Auth **local**.

## Cookies e segurança

Os cookies de sessão permanecem **host-only** (sem `Domain=.control.rn.gov.br`),
com `HttpOnly`, `Secure` em HTTPS e `SameSite` definidos pelo cliente SSR. Isso
permite sessão no host da Vercel e no host institucional durante a transição,
sem compartilhar cookie entre os dois.

CSP e CSRF usam `'self'` / origem da própria requisição e
`NEXT_PUBLIC_APP_URL`. Não há `Access-Control-Allow-Origin: *`.
