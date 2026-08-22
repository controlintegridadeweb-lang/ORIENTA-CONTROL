import { ClipboardList } from "lucide-react";
import { formSurface } from "@/shared/layout/form-surface";

type Props = {
  year: number;
  loading?: boolean;
};

export function RespondentFormsYearEmptyState({ year, loading = false }: Props) {
  return (
    <div className={formSurface.empty.container}>
      <span className={formSurface.empty.iconWrap}>
        <ClipboardList className="h-5 w-5" aria-hidden />
      </span>
      <p className={formSurface.empty.title}>
        {loading ? "Carregando diagnósticos…" : `Nenhum diagnóstico no ano ${year}`}
      </p>
      <p className={formSurface.empty.description}>
        {loading
          ? "Buscando progresso do período selecionado."
          : "Não há diagnósticos liberados neste ano. Se a administração acabou de abrir um diagnóstico, a lista atualiza em instantes. Tente outro ano no filtro acima."}
      </p>
    </div>
  );
}
