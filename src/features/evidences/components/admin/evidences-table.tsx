"use client";

import type { EvidenceListItem } from "@/features/evidences/types";
import { formSurface } from "@/shared/layout/form-surface";
import { Checkbox } from "@/shared/ui/components/checkbox";
import { EvidenceRow } from "./evidence-row";

type Props = {
  items: EvidenceListItem[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAllPage: () => void;
  allPageSelected: boolean;
  onOpenDetail: (item: EvidenceListItem) => void;
};

export function EvidencesTable({
  items,
  selected,
  onToggleSelect,
  onToggleAllPage,
  allPageSelected,
  onOpenDetail,
}: Props) {
  return (
    <div className={`hidden md:block ${formSurface.brandTable.wrapper}`}>
      <table className={`${formSurface.brandTable.table} min-w-270`}>
        <caption className="sr-only">
          Lista de evidências enviadas, com seleção para exportação e ação de detalhes.
        </caption>
        <thead className={formSurface.brandTable.head}>
          <tr>
            <th
              scope="col"
              className={`${formSurface.brandTable.headCell} w-10 align-middle pl-4 sm:pl-5`}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white">
                <Checkbox
                  id="ev-select-all"
                  checked={allPageSelected && items.length > 0}
                  onChange={onToggleAllPage}
                  aria-label="Selecionar todas nesta página"
                />
              </span>
            </th>
            <th scope="col" className={`${formSurface.brandTable.headCell} min-w-32 whitespace-nowrap`}>
              Formulário
            </th>
            <th scope="col" className={`${formSurface.brandTable.headCell} min-w-48`}>
              Pergunta
            </th>
            <th scope="col" className={`${formSurface.brandTable.headCell} min-w-36 whitespace-nowrap`}>
              Organização
            </th>
            <th scope="col" className={`${formSurface.brandTable.headCell} whitespace-nowrap`}>
              Enviada em
            </th>
            <th scope="col" className={`${formSurface.brandTable.headCell} whitespace-nowrap`}>
              Situação
            </th>
            <th scope="col" className={`${formSurface.brandTable.headCell} min-w-40 whitespace-nowrap`}>
              Evidência
            </th>
            <th
              scope="col"
              className={`${formSurface.brandTable.headCell} w-28 whitespace-nowrap align-middle pr-4 text-right sm:pr-5`}
            >
              Ações
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <EvidenceRow
              key={item.id}
              item={item}
              zebraEven={index % 2 === 0}
              selected={selected.has(item.id)}
              onToggleSelect={onToggleSelect}
              onOpen={() => onOpenDetail(item)}
              selectId={`ev-sel-${item.id}`}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
