/** Canais de suporte da Plataforma Orienta. */
export const SUPPORT_CHANNELS = {
  email: {
    label: "E-mail",
    value: "integridadecge@gmail.com",
    href: "mailto:integridadecge@gmail.com",
  },
  whatsapp: {
    label: "WhatsApp",
    value: "(84) 9 8620-0805",
    href: null,
  },
} as const;

export const SUPPORT_PAGE_TITLE = "Suporte";

export const SUPPORT_PAGE_DESCRIPTION =
  "Fale com a Unidade de Integridade por e-mail ou WhatsApp.";

/** Cartilha institucional disponível na página de suporte. */
export const SUPPORT_CARTILHA = {
  title: "Cartilha do Orienta",
  description: "Passo a passo Orienta 2026 para os órgãos.",
  href: "/assets/cartilha-orienta.pdf",
} as const;
