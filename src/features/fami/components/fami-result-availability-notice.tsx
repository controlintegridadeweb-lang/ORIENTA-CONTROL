/** Explica quando o resultado FAMI oficial fica disponível. */
export function FamiResultAvailabilityNotice() {
  return (
    <div
      className="rounded-xl border border-emerald-200/90 bg-emerald-50/80 px-4 py-3.5 text-sm text-emerald-950"
      role="note"
    >
      <div className="space-y-1">
        <p className="font-semibold text-emerald-900">Quando o resultado fica disponível?</p>
        <p className="leading-relaxed text-emerald-900/90">
          Durante o preenchimento, respostas e evidências alimentam o diagnóstico. O{" "}
          <strong className="font-semibold">Resultado FAMI</strong> e as{" "}
          <strong className="font-semibold">recomendações oficiais</strong> ficam disponíveis
          quando a administração conclui a validação do diagnóstico.
        </p>
      </div>
    </div>
  );
}
