import { describe, expect, it } from "vitest";
import { paginateOfficialToc } from "@/shared/export/official-pdf-toc";
import { integrityPlanTocOutline } from "./action-plan-departure-toc";

describe("sumário do relatório de partida", () => {
  it("lista eixo e seção na ordem do documento", () => {
    const outline = integrityPlanTocOutline([
      {
        formName: "Diagnóstico",
        formVersion: "1",
        period: "2026.1",
        organizationName: "Órgão",
        axes: [
          {
            axisName: "Governança",
            sections: [
              {
                sectionName: "Estrutura",
                sectionDisplayNumber: 1,
                recommendations: [],
              },
            ],
          },
        ],
      },
    ]);

    expect(outline).toEqual([
      { title: "Eixo - Governança", level: 0 },
      { title: "Seção 1 - Estrutura", level: 1 },
    ]);
  });

  it("abre uma página a mais quando as entradas não cabem na moldura", () => {
    const entries = Array.from({ length: 40 }, () => ({ level: 0 }));
    expect(paginateOfficialToc(entries).length).toBeGreaterThan(1);
  });
});
