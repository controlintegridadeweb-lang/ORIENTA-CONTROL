"use client";

import { UnderlineTabs } from "@/shared/ui/components/underline-tabs";
import type { FormPublicationState } from "@/features/forms/form-publication-state";
import { useSearchParams } from "next/navigation";
import { withAdminReturnPath } from "@/shared/navigation/admin-navigation-context";

const SEGMENTS = ["configuracao", "estrutura", "respostas"] as const;

const SEGMENT_LABELS: Record<(typeof SEGMENTS)[number], string> = {
  configuracao: "Configuração",
  estrutura: "Estrutura publicada",
  respostas: "Respostas",
};

const TABS = SEGMENTS.map((segment) => ({
  segment,
  label: SEGMENT_LABELS[segment],
}));

export function FormTabs({
  formId,
  scope = "admin",
  embedded = false,
  state,
}: {
  formId: string;
  /** Prefixo de rota admin (sempre `/admin`). */
  scope?: "admin";
  embedded?: boolean;
  state: FormPublicationState;
}) {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const base = `/${scope}/formularios/${formId}`;
  const availableTabs = state === "draft"
    ? TABS.filter((tab) => tab.segment === "configuracao")
    : TABS;
  const tabs = availableTabs.map((t) => ({
    href: withAdminReturnPath(`${base}/${t.segment}`, returnTo),
    label: t.label,
  }));

  return <UnderlineTabs aria-label="Seções do formulário" tabs={tabs} embedded={embedded} />;
}
