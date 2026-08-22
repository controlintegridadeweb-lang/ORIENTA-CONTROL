/**
 * Plataforma Orienta — sistema de design (tokens utilitarios).
 *
 * Estes tokens sao apenas strings de classes Tailwind. As cores reais ficam
 * em `app/globals.css` via `@theme` (variaveis `--color-brand-*`). Para mudar
 * a paleta, mexa la — todas as classes `bg-brand`, `text-brand-*`, etc.
 * passam a refletir.
 *
 * Tokens visuais compartilhados pelos formulários.
 *
 * **Etapa 2 (tipografia, layout de pagina, sidebar):** ver `src/shared/layout/design-system.ts`.
 */
export const formSurface = {
  // ----------------------------------------------------------------- LAYOUT
  pageBg: "bg-slate-50",

  // ----------------------------------------------------------------- CARDS
  /** Painel branco tipo dashboard admin (KPI cards usam a mesma sombra; sem ring). */
  dashboardPanel:
    "rounded-xl border border-slate-200/80 bg-white shadow-card",
  /** Padding padrão dos blocos “Maturidade / Atividades” no admin. */
  dashboardPanelPadding: "p-6 md:p-7",
  /**
   * Card de entidade em lista (recomendações, planos de ação): mesma base que
   * `dashboardPanel` / `card` (radius xl, sombra token), hover alinhado ao KPI.
   */
  entityListCard:
    "relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card",
  /** Use apenas quando o card inteiro for interativo/clicável. */
  entityListCardInteractive:
    "relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card transition hover:border-slate-300 hover:shadow-card-hover",
  /**
   * Título de seção acima de grids/painéis (ex.: “Visão geral”, “Sistema”).
   * Alinhado a `typography.sectionTitle` — use com `<h2>`.
   */
  sectionKicker:
    "text-lg font-semibold tracking-tight text-slate-900 md:text-xl",
  card: "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card",
  cardHeader: "border-b border-slate-100/80 bg-brand-50 px-5 py-4 sm:px-6",
  /** Título interno do card — abaixo do h1 da página (`PageHeader`). */
  cardTitle: "text-base font-semibold leading-snug text-slate-800",
  cardDescription: "mt-1 text-sm font-normal leading-relaxed text-slate-500",
  body: "space-y-5 px-5 py-5 sm:px-6",
  nestedCard: "overflow-hidden rounded-xl border border-slate-200 bg-white p-4",
  subtlePanel: "rounded-xl border border-slate-200 bg-slate-50/70 p-3.5",
  nestedCardWithHeader: "overflow-hidden rounded-xl border border-slate-200 bg-white",

  // ----------------------------------------------------------------- LABELS
  /** Label de formulário — hierarquia tipográfica oficial. */
  label: "text-sm font-medium text-slate-800",
  /** Ajuda curta sob o campo, no recorte do assistente. */
  fieldHint: "text-xs italic leading-relaxed text-slate-500",
  fieldGroup: "space-y-1.5",

  // ----------------------------------------------------------------- INPUTS
  input:
    "w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500",
  /** Texto em barras de filtro: full-width no mobile, largura confortável no desktop. */
  inputToolbar:
    "block w-full min-h-11 max-w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 sm:max-w-64",
  inputSelect:
    "h-11 w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500",
  /** Select em barras de filtro: full-width no mobile, largura confortável no desktop. */
  inputSelectToolbar:
    "h-11 w-full min-h-11 max-w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 sm:max-w-44",
  inputTextarea:
    "min-h-18 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500",
  readOnlyField:
    "flex min-h-11 w-full items-center rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm font-medium text-slate-800 shadow-sm",

  // ----------------------------------------------------------------- BUTTONS
  primaryButton:
    "inline-flex h-11 min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white shadow-sm transition hover:bg-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60",
  primaryButtonSm:
    "inline-flex h-10 min-h-10 items-center justify-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60",
  primaryButtonXs:
    "inline-flex min-h-9 items-center justify-center rounded bg-brand px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60",
  secondaryButton:
    "inline-flex h-11 min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300 disabled:cursor-not-allowed disabled:opacity-60",
  secondaryButtonSm:
    "inline-flex h-10 min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300 disabled:cursor-not-allowed disabled:opacity-60",
  ghostButton:
    "inline-flex h-10 min-h-10 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:bg-slate-100",
  dangerButton:
    "inline-flex h-11 min-h-11 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-4 text-sm font-medium text-rose-700 shadow-sm transition hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300 disabled:cursor-not-allowed disabled:opacity-60",

  // ----------------------------------------------------------------- MESSAGES
  messageNeutral:
    "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700",
  messageError:
    "rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600",
  messageSuccess:
    "rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2.5 text-sm text-emerald-950",
  messageWarning:
    "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900",

  // ----------------------------------------------------------------- TABLES
  table: {
    /** Wrapper externo: borda + sombra + scroll horizontal em mobile. */
    wrapper:
      "min-w-0 overflow-x-auto overscroll-x-contain rounded-xl border border-slate-200 bg-white",
    table: "w-full text-sm",
    head: "sticky top-0 z-10 border-b border-slate-100/80 bg-brand-50/95 text-left text-xs font-medium uppercase tracking-wide text-slate-900 backdrop-blur",
    headCell: "px-4 py-3",
    body: "divide-y divide-slate-100",
    row: "transition hover:bg-slate-50/70",
    cell: "px-4 py-3 align-top text-sm text-slate-700",
    cellMuted: "px-4 py-3 align-top text-sm text-slate-600",
  },
  /**
   * Tabela institucional (cabeçalho brand + linhas ciano claro).
   * Mesmo desenho do acompanhamento quadrimestral do FAMI preliminar.
   */
  brandTable: {
    wrapper:
      "min-w-0 overflow-x-auto overflow-hidden overscroll-x-contain rounded-xl border border-slate-200 bg-white",
    table: "w-full text-sm",
    head: "bg-brand text-left text-sm font-semibold text-white",
    headCell: "px-4 py-3",
    rowEven: "border-t border-slate-200/80 bg-sky-50/70",
    rowOdd: "border-t border-slate-200/80 bg-white",
    cell: "px-4 py-4 align-top text-sm text-slate-700",
    cellMuted: "px-4 py-4 align-top text-sm text-slate-600",
  },

  // ----------------------------------------------------------------- TOOLBAR
  toolbar: {
    /** Barra de titulo/acoes: empilha no mobile (toque confortavel), alinha em linha no desktop. */
    container:
      "flex w-full min-w-0 flex-col gap-4 border-b border-slate-200/50 bg-slate-50/30 px-0 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:bg-transparent sm:py-3.5",
    leftGroup:
      "flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2",
    rightGroup:
      "flex w-full min-w-0 flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2",
  },

  // ----------------------------------------------------------------- BADGES & CHIPS
  /** Fundo claro + texto no tom escuro; sem borda/anel. */
  badge: {
    base: "inline-flex min-h-6 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium leading-none",
    neutral: "bg-slate-100 text-slate-700",
    brand: "bg-brand-50 text-brand-800",
    success: "bg-emerald-50 text-emerald-800",
    warning: "bg-amber-50 text-amber-900",
    danger: "bg-rose-50 text-rose-800",
    info: "bg-sky-50 text-sky-800",
    muted: "bg-violet-50 text-violet-800",
  },
  chip: {
    base: "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition",
    neutral: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    active: "border-brand-300 bg-brand-50 text-brand-700",
  },

  /** Quadro Kanban (workspace operacional — colunas + cards). */
  kanban: {
    /** Contêiner externo: `min-w-0` impede overflow na página. */
    board:
      "min-w-0 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card ring-1 ring-slate-900/[0.02]",
    boardInner: "min-w-0 bg-slate-50 p-3 sm:p-4",
    /** Compatibilidade — a grade não usa scroll horizontal. */
    scrollX: "min-w-0",
    /**
     * Grade responsiva: 1 (celular) → 2 (tablet) → 3 (desktop).
     * Colunas extras vão para a linha seguinte; sem faixa horizontal infinita.
     */
    columnsRow: "grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3",
    /**
     * Coluna = card principal: altura uniforme + lista interna rolável.
     * Cabeçalho fora do overflow; só o corpo rola.
     */
    column:
      "flex h-[min(65dvh,32rem)] w-full min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card",
    /** Faixa semântica no topo (cores sólidas, pouco saturadas). */
    columnAccent: "h-1 w-full shrink-0 rounded-t-[calc(var(--radius-card)-1px)]",
    columnHeader: "shrink-0 border-b border-slate-100 bg-slate-50 px-3 py-2.5",
    columnTitle:
      "line-clamp-2 break-words text-sm font-semibold leading-snug tracking-normal text-slate-900",
    columnDescription: "mt-0.5 text-micro leading-snug text-slate-500",
    columnCount:
      "inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md border border-slate-200/60 bg-white px-2 text-micro font-semibold tabular-nums text-slate-700 shadow-sm",
    /** Lista de registros — única rolagem vertical da coluna. */
    columnBody:
      "kanban-scroll-y flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain p-1.5",
    card:
      "group relative block rounded-lg border border-slate-200/90 bg-white p-2.5 shadow-card transition duration-200 hover:border-slate-300/90 hover:shadow-card-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
    cardContext: "text-2xs font-medium uppercase tracking-wide text-slate-500",
    cardTitle: "mt-1 line-clamp-3 break-words text-sm font-semibold leading-snug text-slate-900",
    cardFooter: "mt-2 border-t border-slate-100/90 pt-1.5",
    /** Empty state compacto. */
    empty:
      "flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200/70 bg-slate-50/40 px-3 py-4 text-center text-xs leading-relaxed text-slate-400",
  },

  // ----------------------------------------------------------------- EMPTY/SKELETON
  empty: {
    container:
      "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200/80 bg-slate-50/40 px-6 py-10 text-center",
    iconWrap:
      "flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700",
    title: "text-base font-semibold leading-snug text-slate-800",
    description: "max-w-prose text-sm font-normal leading-relaxed text-slate-500",
  },
  skeleton: "animate-pulse rounded-md bg-slate-200/70",

  // ----------------------------------------------------------------- FORM FILL (Google Forms–like workspace)
  /** Fundo da rota de preenchimento (substitui o painel branco do `PageShell`). */
  formWorkspace: {
    /** Menos padding lateral que o painel padrão — prioriza área útil do formulário. */
    pageCanvas:
      "w-full min-w-0 bg-slate-100 px-3 py-5 sm:px-4 sm:py-6 md:px-5 md:py-7 lg:px-6 lg:py-8",
    /** Centralizado e amplo (Typeform / Google Forms moderno), sem ocupar a tela inteira. */
    inner:
      "mx-auto w-full min-w-0 space-y-4 max-w-160 sm:max-w-192 md:max-w-224 lg:max-w-240 xl:max-w-256 2xl:max-w-272",
    backLink:
      "inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900",
    shell:
      "rounded-2xl border border-slate-200/70 bg-white shadow-popover ring-1 ring-slate-900/[0.04]",
    header:
      "border-b border-slate-100/90 bg-white px-4 py-5 sm:px-10 sm:py-6 lg:px-12",
    title:
      "break-words text-pretty text-2xl font-semibold leading-snug tracking-tight text-slate-950 md:text-3xl",
    subtitle:
      "mt-2 max-w-none break-words text-sm font-normal leading-relaxed text-slate-600 md:text-base",
    toolbar:
      "flex flex-col gap-3 border-b border-slate-100/90 bg-slate-50/50 px-4 py-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-10 lg:px-12",
    body: "space-y-6 px-4 pt-6 pb-28 sm:px-10 sm:pt-8 sm:pb-32 lg:px-12",
    footer:
      "sticky bottom-0 z-10 border-t border-slate-100 bg-slate-50/95 px-4 py-4 shadow-[0_-6px_16px_-6px_rgb(15_23_42_/_0.1)] backdrop-blur-sm sm:px-10 sm:py-5 lg:px-12",
    sectionsStack: "space-y-16 sm:space-y-20",
    sectionHeader: "space-y-4 border-b border-slate-100/90 pb-6",
    sectionStepRow: "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1",
    sectionStepKicker:
      "inline-flex items-center rounded-full border border-brand-100 bg-brand-50/80 px-3 py-1 text-xs font-medium text-brand-800",
    sectionTitle:
      "break-words text-pretty text-lg font-semibold leading-snug tracking-tight text-slate-900 md:text-xl",
    sectionProgressTrack:
      "h-2.5 w-full overflow-hidden rounded-full bg-slate-200/70 sm:h-3",
    sectionProgressFill:
      "h-full rounded-full bg-brand/90 transition-[width] duration-500 ease-out",
    questionsList: "mt-8 space-y-6 lg:space-y-7",
    questionCard:
      "w-full scroll-mb-28 rounded-xl border border-slate-200/80 bg-white p-4 sm:scroll-mb-32 sm:p-7 lg:p-8",
    questionPrompt:
      "break-words text-pretty text-base font-medium leading-relaxed text-slate-900 sm:text-lg lg:leading-relaxed",
    stepEnterForward: "form-step-enter-forward",
    stepEnterBack: "form-step-enter-back",
  },
} as const;
