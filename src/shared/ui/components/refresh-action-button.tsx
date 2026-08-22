"use client";

import { RefreshCw } from "lucide-react";
import { formSurface } from "@/shared/layout/form-surface";

type Props = {
  onRefresh: () => void;
  refreshing: boolean;
  label?: string;
};

export function RefreshActionButton({ onRefresh, refreshing, label = "Atualizar" }: Props) {
  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={refreshing}
      className={formSurface.secondaryButtonSm}
    >
      <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
      {label}
    </button>
  );
}
