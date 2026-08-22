"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import { LoadingButton } from "@/shared/ui/components/loading";
import { formSurface } from "@/shared/layout/form-surface";

export type OrgOption = { id: string; name: string };

/**
 * Modal para definir a quais organizações uma pergunta não se aplica.
 *
 * A regra é permanente e vale em qualquer formulário que inclua a pergunta —
 * diferente de "Não se aplica neste diagnóstico", escolhida pelo respondente.
 */
export function WaiverEditorModal({
  open,
  questionPrompt,
  organizations,
  selectedOrgIds,
  reason,
  hasMixedReasons,
  reasonTouched,
  orgFilter,
  saving,
  onOrgFilterChange,
  onToggleOrg,
  onSelectAll,
  onClearAll,
  onReasonChange,
  onClose,
  onSave,
}: {
  open: boolean;
  questionPrompt: string;
  organizations: OrgOption[];
  selectedOrgIds: Set<string>;
  reason: string;
  hasMixedReasons: boolean;
  reasonTouched: boolean;
  orgFilter: string;
  saving: boolean;
  onOrgFilterChange: (value: string) => void;
  onToggleOrg: (orgId: string) => void;
  onSelectAll: (orgIds: string[]) => void;
  onClearAll: () => void;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const filteredOrgs = useMemo(() => {
    const q = orgFilter.trim().toLowerCase();
    if (!q) return organizations;
    return organizations.filter((o) => o.name.toLowerCase().includes(q));
  }, [organizations, orgFilter]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="waiver-editor-title"
    >
      <div className="flex max-h-[min(90vh,180)] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-100/80">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 bg-brand-50 px-5 py-4">
          <div className="min-w-0">
            <h3 id="waiver-editor-title" className={formSurface.cardTitle}>
              Organizações para as quais a pergunta não se aplica
            </h3>
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-600">
              {questionPrompt}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="shrink-0 rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <p className="text-xs leading-relaxed text-slate-600">
            Marque todas as organizações para as quais esta pergunta{" "}
            <strong className="font-semibold text-slate-800">não se aplica</strong>. Essa definição
            vale em qualquer formulário que inclua a pergunta.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={orgFilter}
              onChange={(e) => onOrgFilterChange(e.target.value)}
              placeholder="Filtrar organizações..."
              className={`min-w-50 flex-1 ${formSurface.input}`}
            />
            <button
              type="button"
              disabled={saving || filteredOrgs.length === 0}
              onClick={() => onSelectAll(filteredOrgs.map((o) => o.id))}
              className={`${formSurface.secondaryButtonSm} disabled:opacity-50`}
            >
              Marcar visíveis
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onClearAll}
              className={`${formSurface.secondaryButtonSm} disabled:opacity-50`}
            >
              Limpar
            </button>
          </div>

          <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-2">
            {filteredOrgs.length === 0 ? (
              <li className="px-2 py-3 text-center text-xs text-slate-500">
                Nenhuma organização encontrada.
              </li>
            ) : (
              filteredOrgs.map((org) => {
                const checked = selectedOrgIds.has(org.id);
                return (
                  <li key={org.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-800 hover:bg-white">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={saving}
                        onChange={() => onToggleOrg(org.id)}
                        className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
                      />
                      <span className="min-w-0 flex-1 truncate">{org.name}</span>
                    </label>
                  </li>
                );
              })
            )}
          </ul>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-600">
            Justificativa (opcional)
            <textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              disabled={saving}
              rows={3}
              maxLength={1000}
              placeholder={
                hasMixedReasons && !reasonTouched
                  ? "Existem justificativas diferentes; edite para substituir todas."
                  : "Ex.: estrutura militar sem comitê de sustentabilidade"
              }
              className={formSurface.inputTextarea}
            />
            <span className="text-micro font-normal text-slate-500">
              {hasMixedReasons && !reasonTouched
                ? "As justificativas existentes serão preservadas. Ao editar este campo, o novo texto será aplicado a todas as organizações marcadas."
                : "Aplicada às organizações marcadas ao salvar."}
            </span>
          </label>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3">
          <span className="mr-auto text-xs text-slate-500">
            {selectedOrgIds.size} organizaç{selectedOrgIds.size === 1 ? "ão" : "ões"} selecionada
            {selectedOrgIds.size === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className={`${formSurface.secondaryButtonSm} disabled:opacity-50`}
          >
            Cancelar
          </button>
          <LoadingButton
            type="button"
            pending={saving}
            pendingLabel="Salvando aplicabilidade…"
            onClick={onSave}
            className={`inline-flex items-center gap-1.5 ${formSurface.primaryButtonSm} disabled:opacity-50`}
          >
            Salvar aplicabilidade
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}
