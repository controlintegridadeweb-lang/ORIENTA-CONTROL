/**
 * Plataforma Orienta — Etapa 2 · Mini design system
 *
 * Referência visual oficial: dashboard do administrador (`/admin`) — KPIs
 * (`MetricCard`), painéis (`formSurface.dashboardPanel`),
 * `PageHeader` / `SectionHeader`, shell
 * (`AppShell` + sidebar brand flat).
 *
 * Hierarquia de tokens:
 * 1. **Cores, sombras, radius, tipografia base do `body`:** `src/app/globals.css`
 *    (`:root`, `@theme`, comentários da escala tipográfica).
 * 2. **Superfícies, formulários, botões, tabelas, empty states:** `formSurface`
 *    em `form-surface.ts` nesta pasta (import `{ formSurface }` ou `{ ds }`).
 * 3. **Tipografia de interface e ritmo de página (esta API):** `typography`,
 *    `layout`. Preferir estes presets em páginas novas para não divergir do
 *    dashboard. O conteúdo logado fica em `PageShell` (`components/layout/page-shell.tsx`).
 * 4. **Sidebar (navegação):** `sidebar` — classes usadas em `SidebarNavLink`;
 *    o layout da coluna (cor sólida, collapse) permanece em `sidebar-shell.tsx`
 *    e `globals.css` (`aside[data-collapsed]`).
 *
 * Documentação oficial da hierarquia: `docs/current/design-system/tipografia.md`.
 *
 * **Hierarquia / UX:** o `<h1>` da rota fica em `PageHeader` (ou hero ilustrado
 * equivalente). O shell sticky em modo `controls-only` não compete com o h1.
 * Seções internas usam `SectionHeader` (`<h2>`); subseções usam
 * `typography.subsectionTitle` (`<h3>`).
 */

import { formSurface } from "./form-surface";

/**
 * Hierarquia tipográfica oficial da Plataforma ORIENTA.
 * Um único conjunto para administrador e respondente.
 */
export const typography = {
  /**
   * `<h1>` da página — uma vez por rota.
   * Usado em `PageHeader`, heróis ilustrados e cabeçalho sticky (modo full).
   */
  pageTitle:
    "break-words text-2xl font-semibold leading-snug tracking-tight text-slate-950 md:text-3xl",
  /** Subtítulo / descrição logo abaixo do título principal. */
  pageDescription:
    "mt-2 max-w-prose text-sm font-normal leading-relaxed break-words text-slate-600 md:text-base",
  /**
   * Título de agrupamento acima de KPIs ou blocos no dashboard
   * (ex.: "Visão geral", "Sistema") — semanticamente `<h2>`.
   */
  sectionLabel:
    "break-words text-lg font-semibold leading-snug tracking-tight text-slate-900 md:text-xl",
  /**
   * Hierarquia tipográfica dos cards de métrica (`MetricCard` e equivalentes).
   * Ordem de leitura: título → valor → descrição → ação.
   */
  metricLabel: "break-words text-base font-semibold leading-snug text-slate-800",
  metricValue:
    "text-3xl font-semibold tabular-nums tracking-tight text-slate-950 md:text-4xl",
  metricValueCompact:
    "text-2xl font-semibold tabular-nums tracking-tight text-slate-950 md:text-3xl",
  metricSecondary: "text-sm font-normal leading-relaxed break-words text-slate-500",
  metricCta: "inline-flex items-center gap-1 text-sm font-medium text-slate-800",
  /** Kicker opcional *dentro* de painéis, acima do `<h2>` (`SectionHeader`). */
  panelEyebrow: "text-sm font-medium leading-snug text-slate-500",
  /** Contexto estrutural curto (diagnóstico, eixo, seção) sem competir com headings. */
  contextLabel: "text-xs font-medium leading-snug text-slate-500",
  /** Alias estável do título principal fora dos containers de conteúdo. */
  pageIntroTitle:
    "break-words text-2xl font-semibold leading-snug tracking-tight text-slate-950 md:text-3xl",
  /** Alias estável da descrição da página. */
  pageIntroDescription:
    "mt-2 max-w-prose text-sm font-normal leading-relaxed break-words text-slate-600 md:text-base",
  /** `<h2>` de seção em painéis e páginas de conteúdo. */
  sectionTitle:
    "break-words text-lg font-semibold leading-snug tracking-tight text-slate-900 md:text-xl",
  /** Parágrafo descritivo sob o título de seção. */
  sectionDescription: "mt-1.5 text-sm font-normal leading-relaxed break-words text-slate-600",
  /** `<h3>` de subseção / agrupamento interno. */
  subsectionTitle: "break-words text-base font-semibold leading-snug text-slate-900 md:text-lg",
  /** Título interno de card (não métrica). */
  cardTitle: "break-words text-base font-semibold leading-snug text-slate-800",
  /** Texto explicativo de card. */
  cardDescription: "text-sm font-normal leading-relaxed text-slate-500",
  /** Link ou ação textual de card / cabeçalho. */
  cardAction: "text-sm font-medium text-slate-800",
  /** Label de campo de formulário. */
  fieldLabel: "text-sm font-medium text-slate-800",
  /**
   * Ícone em caixa ao lado do título de seção (opcional), como em
   * `SectionHeader`.
   */
  sectionTitleIconWrap:
    "flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600",
  /**
   * Link textual de ação secundária no canto do cabeçalho de seção
   * (ex.: "Ver todos", "Abrir validações").
   */
  inlineNavLink:
    "inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-slate-700 underline-offset-2 transition hover:text-slate-950 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand/35",
  /** Metadados em listas densas (tabelas, cards de fila). */
  meta: "text-xs text-slate-500",
  /** Texto auxiliar. */
  auxiliary: "text-sm font-normal text-slate-500",
  /** Mensagem de erro inline (campo / formulário). */
  errorText: "text-sm font-medium text-red-600",
  /**
   * Título principal dentro de painel ou ferramenta (use `<h2>`: o `<h1>` é o
   * título da rota no `PageHeader`).
   */
  panelHeroTitle:
    "break-words text-lg font-semibold leading-snug tracking-tight text-slate-900 md:text-xl",
  /** Subtítulo sob o título do painel. */
  panelHeroLead: "mt-1.5 text-sm font-normal leading-relaxed break-words text-slate-600",
} as const;

/**
 * Ritmo vertical e grids usados nos dashboards (admin, respondente).
 * O `<main>` do `AppShell` aplica padding e `max-width`; o conteúdo da rota fica
 * dentro de `PageShell` (painel arredondado). Na raiz do filho use `pageStack`.
 *
 * Espaçamento tipográfico (referência):
 * - título página → subtítulo: 8px (`mt-2`)
 * - cabeçalho página → conteúdo: 24–32px (`mb-6` / `mb-8`)
 * - título seção → descrição: 4–8px (`mt-1` / `mt-1.5`)
 * - cabeçalho seção → conteúdo: 16–24px (`mb-4` / `mb-6`)
 * - seção → seção: 32–48px (`pageStack` / `space-y-8`–`12`)
 */
export const layout = {
  /**
   * Área útil ao redor do painel principal (dentro de `<main>`): largura total e
   * ritmo vertical leve entre o painel e as bordas da viewport em telas altas.
   */
  pageShellOuter: "w-full min-w-0",
  /**
   * Painel SaaS: fundo elevado, borda suave, raio maior que cartões internos
   * (`rounded-xl` em `formSurface.dashboardPanel`).
   */
  pageShell:
    "w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200/50 bg-white shadow-sm ring-1 ring-slate-900/[0.025]",
  /** Padding interno consistente do painel (título implícito no header global). */
  pageShellPadding: "p-4 sm:p-6 md:p-7 lg:p-8",
  /**
   * Barra de filtros / campos empilhados no mobile, alinhados em linha no desktop.
   * Preferir labels em coluna com inputs `w-full` até `sm:` (ver `inputToolbar`).
   */
  filterRow:
    "flex w-full min-w-0 flex-col gap-4 border-b border-slate-200/50 bg-slate-50/50 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-4 sm:gap-y-3 sm:px-5 sm:py-3.5",
  /** Espaço entre grandes blocos da página (variável CSS `--space-section-y`). */
  pageStack: "space-y-[var(--space-section-y)]",
  /** Espaço interno típico de uma `<section>` (título + grid ou painel). */
  sectionStack: "space-y-4",
  /** Grid de KPIs do admin (4 colunas em XL). */
  kpiGrid4: "grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 xl:grid-cols-4",
  /** Grid de KPIs em três colunas (respondente / admin). */
  kpiGrid3: "grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-5",
  /** Dois KPIs lado a lado (bloco “Sistema” no admin). */
  kpiGrid2: "grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5",
  /** Cinco indicadores (evidências, recomendações, maturidade). */
  kpiGrid5: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  /** Maturidade (3 col) + evidências (2 col) no dashboard admin. */
  maturityAndEvidenceGrid: "grid grid-cols-1 gap-4 xl:grid-cols-5 xl:gap-5",
  /** Dois painéis lado a lado (ex.: maturidade + evidências). */
  twoPanelGrid: "grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-5",
  /**
   * Cabeçalho de página: título à esquerda, ações empilhadas no mobile e
   * alinhadas à direita a partir de `sm`.
   */
  pageHeaderRow:
    "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
  /** Grupo de ações do cabeçalho (botões full-width no celular). */
  pageHeaderActions:
    "flex w-full min-w-0 flex-col gap-2 [&>a]:w-full [&>button]:w-full sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:[&>a]:w-auto sm:[&>button]:w-auto",
  /** Grid padrão de filtros (1 → 2 → 4 colunas). */
  filterGrid: "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4",
  /**
   * Classes do `<main>` do `AppShell` (largura máx., padding, `min-w-0`).
   * Reutilize se montar layout fora do shell por engano; o padrão é o próprio
   * `AppShell`.
   */
  appMain:
    "mx-auto min-w-0 w-full flex-1 px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8 xl:max-w-360 2xl:max-w-390",
  /**
   * Espaço vertical entre blocos densos *dentro* de uma ferramenta (KPIs,
   * filtros, tabela) — um pouco mais ar que `sectionStack` para leitura.
   */
  panelStack: "space-y-6",
} as const;

/** Links da navegação lateral (fundo brand); ícone 18px + label. */
export const sidebar = {
  groupLabel:
    "sb-group px-3 text-micro font-semibold uppercase tracking-[0.08em] text-white/65",
  link: "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-white/88 transition hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white",
  linkActive:
    "sb-link-active flex items-center gap-3 rounded-lg bg-white/18 px-3.5 py-2.5 text-sm font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255_/_0.12)] ring-2 ring-white/35 backdrop-blur-xs",
} as const;

/** Superfícies e cartões (delegam a `formSurface`; uso opcional para um só import). */
export const cards = {
  dashboardPanel: formSurface.dashboardPanel,
  dashboardPanelPadding: formSurface.dashboardPanelPadding,
  entityList: formSurface.entityListCard,
  kanban: formSurface.kanban,
  default: formSurface.card,
  nested: formSurface.nestedCard,
  cardHeader: formSurface.cardHeader,
  cardTitle: formSurface.cardTitle,
  cardDescription: formSurface.cardDescription,
} as const;
