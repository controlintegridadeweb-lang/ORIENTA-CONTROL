type Props = {
  id?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

/** Toggle contextual para exigência de evidência em perguntas do formulário. */
export function FormEvidenceRequirementField({ id, checked, disabled, onChange }: Props) {
  return (
    <div className="rounded-lg border border-slate-200/90 bg-slate-50/60 px-4 py-3">
      <label
        htmlFor={id}
        className="flex cursor-pointer items-start gap-3 select-none"
      >
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 rounded border border-slate-200 text-brand focus:ring-brand/30 disabled:cursor-not-allowed"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-slate-900">Exigir evidência</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
            Respostas &quot;Sim&quot; exigirão comprovação.
          </span>
        </span>
      </label>
    </div>
  );
}
