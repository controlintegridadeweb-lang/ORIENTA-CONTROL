# Hierarquia tipográfica — Plataforma ORIENTA

Documento oficial da tipografia de interface para **administrador** e **respondente**.
Não invente classes locais para os mesmos papéis semânticos; use os tokens e componentes abaixo.

Implementação: `src/shared/layout/design-system.ts` (`typography`) e
`src/shared/layout/form-surface.ts` (labels, cards, empty states).

## Componentes

| Papel | Componente | Heading |
|-------|------------|---------|
| Título + descrição da página | `PageHeader` | `h1` (uma vez por rota) |
| Hero ilustrado institucional | `IllustratedPageHero` | `h1` |
| Título de seção | `SectionHeader` / `PanelSection` | `h2` |
| Subseção | `typography.subsectionTitle` | `h3` |
| Card de métrica | `MetricCard` | — |
| Estado vazio | `EmptyState` | — |

O shell sticky (`AppShellPageHeader`) em modo `controls-only` **não** renderiza `h1`.
O título da rota fica no `PageHeader` / hero da página.

## Escala oficial

### 1. Título principal da página — `h1`

```txt
text-2xl md:text-3xl font-semibold tracking-tight text-slate-950
```

Token: `typography.pageTitle`

### 2. Subtítulo / descrição da página

```txt
text-sm md:text-base font-normal leading-relaxed text-slate-600
```

Token: `typography.pageDescription` (inclui `mt-2` → 8px abaixo do título)

### 3. Título de seção — `h2`

```txt
text-lg md:text-xl font-semibold tracking-tight text-slate-900
```

Token: `typography.sectionTitle`

### 4. Descrição de seção

```txt
text-sm font-normal leading-relaxed text-slate-600
```

Token: `typography.sectionDescription`

### 5. Título de subseção — `h3`

```txt
text-base md:text-lg font-semibold text-slate-900
```

Token: `typography.subsectionTitle`

### 6. Título de card

```txt
text-base font-semibold leading-snug text-slate-800
```

Tokens: `typography.cardTitle` / `typography.metricLabel` / `formSurface.cardTitle`

### 7. Número ou indicador principal

```txt
text-3xl md:text-4xl font-semibold tracking-tight tabular-nums text-slate-950
```

Token: `typography.metricValue` (`metricValueCompact` para densidade menor)

#### Variantes semânticas do `MetricCard` (linha lateral sólida, tons 300)

Paleta clara institucional — a cor comunica só o significado do indicador; título e valor permanecem neutros (`slate`).

| Variante | Classe | Hex aprox. | Uso |
|----------|--------|------------|-----|
| `neutral` | `slate-300` | `#CBD5E1` | totais no escopo, filtros, informações sem juízo |
| `info` | `sky-300` | `#7DD3FC` | em execução / andamento, ativos, relatórios |
| `success` | `emerald-300` | `#6EE7B7` | concluídas, aprovados, conformes |
| `warning` | `amber-300` | `#FCD34D` | aguardando ação, pendentes, atenção |
| `danger` | `red-300` | `#FCA5A5` | atrasadas, reprovados, erros, bloqueios |

**Seleção** (`selected` / filtro ativo): `ring-2 ring-sky-200 border-sky-300` — anel institucional, independente da variante semântica. Não use a cor da linha lateral para indicar seleção.

Se a escala 300 ainda contrastar demais com a UI, use a escala 200 (`slate-200`, `sky-200`, `emerald-200`, `amber-200`, `red-200`) mantendo saturação uniforme entre variantes.

#### Níveis de maturidade FAMI (`maturityLevelVariants`)

Paleta clara reutilizável em `src/features/fami/maturity-level-variants.ts`. Cabeçalho em escala 100, borda/selo em 200, texto escuro da mesma família; corpo do card branco.

| Nível | Variante | Família |
|-------|----------|---------|
| 1 Inicial | `initial` | rose |
| 2 Em desenvolvimento | `developing` | amber |
| 3 Intermediário | `intermediate` | sky |
| 4 Avançado | `advanced` | indigo |
| 5 Maduro | `mature` | emerald |

Componente: `MaturityLevelCard` (roadmap). Destaque do nível atual: `ring-2 ring-sky-200 border-sky-300` (não usa a cor do nível como seleção).

### 8. Texto explicativo de card

```txt
text-sm font-normal leading-relaxed text-slate-500
```

Tokens: `typography.cardDescription` / `typography.metricSecondary`

### 9. Link ou ação do card

```txt
text-sm font-medium text-slate-800
```

Tokens: `typography.cardAction` / `typography.metricCta` / `typography.inlineNavLink`

### 10. Label de formulário

```txt
text-sm font-medium text-slate-800
```

Tokens: `typography.fieldLabel` / `formSurface.label`

### 11. Texto auxiliar

```txt
text-sm font-normal text-slate-500
```

Token: `typography.auxiliary`

### 12. Mensagem de erro

```txt
text-sm font-medium text-red-600
```

Token: `typography.errorText` (containers: `formSurface.messageError`)

## Estrutura da página

```tsx
<PageHeader
  title="Título da página"
  description="Descrição objetiva da página."
/>

<section>
  <SectionHeader
    title="Título da seção"
    description="Descrição opcional da seção."
  />
  {/* container / painel — só conteúdo interno */}
</section>
```

O título de seção (ex.: “Filtros”) fica **sempre fora** do container.
O painel contém apenas campos, listas e ações internas.

## Cards de indicadores

Ordem visual em `MetricCard`:

1. título + ícone;
2. número principal;
3. texto explicativo / status;
4. ação no rodapé (`mt-auto`).

## Espaçamento

| Relação | Token Tailwind | px |
|---------|----------------|-----|
| Título página → subtítulo | `mt-2` | 8 |
| Cabeçalho página → conteúdo | `mb-6` / `sm:mb-8` | 24–32 |
| Título seção → descrição | `mt-1.5` | 6 |
| Cabeçalho seção → conteúdo | `mb-4` / `sm:mb-6` | 16–24 |
| Título card → número | `mt-4` | 16 |
| Número → descrição | `mt-2` | 8 |
| Descrição → ação | `pt-4` + `mt-auto` | 16 |
| Seção → seção | `layout.pageStack` | 32–48 |

## Regras

- Um único `h1` por página.
- Ordem semântica `h1` → `h2` → `h3`.
- Sem tamanhos arbitrários (`text-[17px]`, clamps de título).
- Sem estilos inline de tipografia.
- Sem gradientes em tipografia; cores sólidas.
- Admin e respondente compartilham a mesma escala.
- Não alterar textos institucionais, regras de domínio ou fluxos ao aplicar tipografia.

## Consistência de navegação e superfícies

A hierarquia visual deve refletir a arquitetura da informação sem criar novos níveis decorativos.

- Contexto hierárquico: use `ContextTrail` para caminhos como **Diagnóstico → Eixo → Seção**.
- Identidade do eixo: use `AxisBadge`/`getAxisTheme`; não replique hexadecimal de Governança, Ambiental ou Social em features.
- Abas locais: use `UnderlineTabs`; em telas estreitas o componente preserva uma única linha com rolagem horizontal.
- Status: use `StatusPill` ou badges de domínio construídos sobre ele. Não crie spans locais equivalentes.
- Indicadores: use `MetricCard`; não recrie KPI com card e tipografia próprios.
- Cards: uma superfície principal por agrupamento. Prefira divisores, listas e `dl` internos a empilhar card dentro de card.
- Hover/elevação: somente superfícies realmente interativas recebem `entityListCardInteractive`; cards informativos usam `entityListCard`.
- Ações de `PageHeader`: no mobile ocupam a largura disponível e retornam ao tamanho natural a partir de `sm`.
- Estados vazios: use `EmptyState`; loading e erro devem usar os componentes compartilhados equivalentes.

### Hierarquia do Plano de integridade e compliance

A apresentação gerencial usa sempre a mesma ordem:

```text
Diagnóstico
→ Eixo
→ Seção
→ Plano de integridade e compliance da seção
→ Ações
```

A origem técnica permanece visível, sem virar um segundo guarda-chuva visual:

```text
Pergunta
→ Recomendação
→ Ação
→ Comprovação
→ Supervisão
```

A cor do eixo é um **sinal cognitivo pontual** (badge, borda, marcador ou gráfico), não um fundo dominante de toda a página.

## Gate automático

Execute:

```bash
npm run check:visual-consistency
```

O gate impede regressões objetivas como tamanhos `text-[Npx]`, headings locais equivalentes aos tokens oficiais, import duplicado do design system e cores estruturais dos eixos fora de `src/shared/theme/axis-theme.ts`.
